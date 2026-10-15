/**
 * 勉強部屋（メールサーバー）の台本：「設定カード」。1枚のカードで、1つの設定を学ぶ（はじめに だけは、ことばを学ぶ）。
 * LPIC-2（202 試験）の「電子メールサービス」の範囲：Postfix（main.cf・aliases・中継の制限・SMTP AUTH・TLS・relayhost・キュー）、
 * Dovecot（IMAP・POP3・平文のログイン・mail_location・LMTP と Sieve）、sendmail（sendmail.mc と m4・access と makemap）。
 *
 * かたちは LDAP の勉強部屋と同じ（study-kit.ts）：設定なし → 入れる → 設定あり → 落とし穴 → 見くらべる。
 * ステップの cmd は、ボタンを押すとターミナルで本当に動く（しくみは mail.ts / mail-shell.ts）。
 * fuzz（scripts/fuzz-infra.mjs）で、どのカードも最初から最後まで通ることを確かめる。
 */
import { MailWorld, inCidr, pfGet, pfIsLocalConf, m4Sendmail, HOST_IP, type Mail, type Stored } from "./mail";
import { MailLab, type HostId, type Run } from "./mail-shell";
import { prepareWith, splitStudy, type PrepRunOf, type StudyCardOf } from "./study-kit";

export type MailPanel = "trace" | "packets" | "logs" | "boxes" | "config";
export type MailCard = StudyCardOf<MailLab, Run, HostId, MailPanel>;
export type MailPrepRun = PrepRunOf<Run, HostId>;

export const MAIL_CHAPTERS = [
  { no: 0, title: "はじめに", sub: "メールが届くまでと、ことば" },
  { no: 1, title: "メールを受けとる", sub: "自分のドメイン・別名" },
  { no: 2, title: "メールを守る", sub: "中継・ログイン・暗号" },
  { no: 3, title: "届ける・読む", sub: "Maildir・Sieve・中継サーバー" },
  { no: 4, title: "sendmail", sub: "sendmail.mc と m4・access" },
] as const;

/** 種（同じカードは、いつも同じ乱数） */
export const MAIL_SEED_BASE = 2000;

/* ------------------------------------------------------------ 共通のシナリオ（わんこ商店のメールサーバー） */

/** それぞれの正しいパスワード（台本で使う。本人が打ったことにする） */
export const MAIL_PW = { pochi: "Pochi#2026", hana: "Hana@0701", momo: "Momo*0303", kuro: "Kuro&1120" } as const;

const MAIN_CF = (extra: Record<string, string | null>) => {
  const base: [string, string][] = [
    ["compatibility_level", "3.6"],
    ["queue_directory", "/var/spool/postfix"],
    ["command_directory", "/usr/sbin"],
    ["daemon_directory", "/usr/libexec/postfix"],
    ["mail_owner", "postfix"],
    ["myhostname", "mail.wanko.shop"],
    ["mydomain", "wanko.shop"],
    ["myorigin", "$mydomain"],
    ["inet_interfaces", "all"],
    ["inet_protocols", "ipv4"],
    ["mydestination", "$myhostname, localhost.$mydomain, localhost, $mydomain"],
    ["unknown_local_recipient_reject_code", "550"],
    ["alias_maps", "hash:/etc/aliases"],
    ["alias_database", "hash:/etc/aliases"],
    ["home_mailbox", "Maildir/"],
    ["smtpd_banner", "$myhostname ESMTP $mail_name"],
    ["smtpd_relay_restrictions", "permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"],
  ];
  const lines = ["# /etc/postfix/main.cf（この部屋で使うところだけ。ふつうは説明のコメントがたくさんある）", ""];
  const seen = new Set<string>();
  for (const [k, v] of base) {
    seen.add(k);
    const over = k in extra ? extra[k] : v;
    if (over != null) lines.push(`${k} = ${over}`);
  }
  for (const [k, v] of Object.entries(extra)) if (!seen.has(k) && v != null) lines.push(`${k} = ${v}`);
  return lines.join("\n") + "\n";
};

const MASTER_CF = `# /etc/postfix/master.cf（Postfix の中のプログラムの一覧）
# service type  private unpriv  chroot  wakeup  maxproc command + args
smtp      inet  n       -       n       -       -       smtpd
#submission inet n       -       n       -       -       smtpd
#  -o syslog_name=postfix/submission
#  -o smtpd_tls_security_level=encrypt
#  -o smtpd_sasl_auth_enable=yes
pickup    unix  n       -       n       60      1       pickup
cleanup   unix  n       -       n       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
smtp      unix  -       -       n       -       -       smtp
local     unix  -       n       n       -       -       local
lmtp      unix  -       -       n       -       -       lmtp
`;

const ALIASES = `#
#  /etc/aliases — 別名（この名前あてのメールを、だれに届けるか）。書きかえたら newaliases
#
mailer-daemon:	postmaster
postmaster:	root
abuse:		root
webmaster:	root
`;

const DOVECOT_CONF = `# /etc/dovecot/dovecot.conf
protocols = imap pop3
!include conf.d/*.conf
`;
const AUTH_CONF = (plain: "yes" | "no") =>
  `# /etc/dovecot/conf.d/10-auth.conf
${plain === "no" ? "# うまくつながらなかったので、とりあえず no にした\n" : ""}disable_plaintext_auth = ${plain}
auth_mechanisms = plain
`;
const MAIL_CONF = (loc: string) => `# /etc/dovecot/conf.d/10-mail.conf\nmail_location = ${loc}\n`;
const SSL_CONF = `# /etc/dovecot/conf.d/10-ssl.conf
ssl = yes
ssl_cert = </etc/pki/dovecot/certs/dovecot.pem
ssl_key = </etc/pki/dovecot/private/dovecot.pem
`;
const MASTER_DC = (lmtp: boolean) => `# /etc/dovecot/conf.d/10-master.conf
service auth {
  # Postfix の SMTP AUTH の受け口
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
${
  lmtp
    ? `service lmtp {
  # Postfix からメールを受けとる受け口（LMTP）
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
`
    : ""
}`;
const LMTP_CONF = `# /etc/dovecot/conf.d/20-lmtp.conf
protocol lmtp {
  mail_plugins = $mail_plugins sieve
}
`;
const PEM = (what: string) => `-----BEGIN ${what}-----\nMIIC（この部屋の中だけの、見本のファイル）\n-----END ${what}-----\n`;

const SENDMAIL_MC = (local: boolean) => `divert(-1)dnl
dnl # /etc/mail/sendmail.mc（この部屋で使うところだけ）
dnl # 書きかえたら m4 で sendmail.cf を作りなおして、sendmail を再起動する
divert(0)dnl
include(\`/usr/share/sendmail-cf/m4/cf.m4')dnl
VERSIONID(\`setup for linux')dnl
OSTYPE(\`linux')dnl
define(\`ALIAS_FILE', \`/etc/aliases')dnl
FEATURE(\`use_cw_file')dnl
FEATURE(\`access_db', \`hash -T<TMPF> -o /etc/mail/access.db')dnl
FEATURE(\`local_procmail', \`', \`procmail')dnl
dnl # 外からも受けとるときは、Addr=127.0.0.1, を消す
DAEMON_OPTIONS(\`Port=smtp,${local ? "Addr=127.0.0.1, " : ""}Name=MTA')dnl
MAILER(smtp)dnl
MAILER(procmail)dnl
`;
const ACCESS = `# /etc/mail/access — だれを中継してよいか。書きかえたら makemap hash /etc/mail/access < /etc/mail/access
Connect:localhost.localdomain		RELAY
Connect:localhost			RELAY
Connect:127.0.0.1			RELAY
`;

type Recipe = {
  mta?: "postfix" | "sendmail";
  /** main.cf の行（null は書かない） */
  main?: Record<string, string | null>;
  /** 平文のログイン（10-auth.conf の disable_plaintext_auth） */
  plain?: "yes" | "no";
  mailLocation?: string;
  /** LMTP と Sieve の用意 */
  sieve?: boolean;
  op25b?: boolean;
  /** sendmail が 127.0.0.1 だけで待つ */
  smLocal?: boolean;
  files?: Record<string, string>;
  /** はじめから届いているメール（mbox：/var/mail/…） */
  oldMbox?: { user: string; subject: string; body: string }[];
  /** はじめからあるフォルダー（Maildir） */
  folders?: { user: string; folder: string }[];
};

function scenario(seed: number, r: Recipe): MailLab {
  const mta = r.mta ?? "postfix";
  const files: Record<string, string> = {
    "/etc/aliases": ALIASES,
    "/etc/dovecot/dovecot.conf": r.sieve ? DOVECOT_CONF.replace("imap pop3", "imap pop3 lmtp") : DOVECOT_CONF,
    "/etc/dovecot/conf.d/10-auth.conf": AUTH_CONF(r.plain ?? "yes"),
    "/etc/dovecot/conf.d/10-mail.conf": MAIL_CONF(r.mailLocation ?? (mta === "sendmail" ? "mbox:~/mail:INBOX=/var/mail/%u" : "maildir:~/Maildir")),
    "/etc/dovecot/conf.d/10-ssl.conf": SSL_CONF,
    "/etc/dovecot/conf.d/10-master.conf": MASTER_DC(Boolean(r.sieve)),
    "/etc/pki/dovecot/certs/dovecot.pem": PEM("CERTIFICATE"),
    "/etc/pki/dovecot/private/dovecot.pem": PEM("PRIVATE KEY"),
    "/etc/pki/tls/certs/mail.crt": PEM("CERTIFICATE"),
    "/etc/pki/tls/private/mail.key": PEM("PRIVATE KEY"),
  };
  if (r.sieve) files["/etc/dovecot/conf.d/20-lmtp.conf"] = LMTP_CONF;
  if (mta === "postfix") {
    files["/etc/postfix/main.cf"] = MAIN_CF(r.main ?? {});
    files["/etc/postfix/master.cf"] = MASTER_CF;
  } else {
    const mc = SENDMAIL_MC(r.smLocal ?? false);
    files["/etc/mail/sendmail.mc"] = mc;
    files["/etc/mail/sendmail.cf"] = m4Sendmail(mc).cf;
    files["/etc/mail/access"] = ACCESS;
    files["/etc/mail/local-host-names"] = "# /etc/mail/local-host-names — 自分あてとして受けとるドメイン\nwanko.shop\n";
  }
  Object.assign(files, r.files ?? {});
  const w = new MailWorld({ seed, mta, files, op25b: r.op25b, passwords: { ...MAIL_PW } });
  for (const [k, m] of (r.oldMbox ?? []).entries()) {
    const mail: Mail = {
      qid: w.qid("postfix"),
      from: "pochi@wanko.shop",
      rcpts: [`${m.user}@wanko.shop`],
      head: [
        ["Date", "Thu, 8 Oct 2026 18:0" + k + ":00 +0900"],
        ["From", "pochi@wanko.shop"],
        ["To", `${m.user}@wanko.shop`],
        ["Subject", m.subject],
      ],
      body: m.body,
      at: w.clock - 7 * 86400e3,
      size: 420,
    };
    w.storeMbox(`/var/mail/${m.user}`, mail, `${m.user}@wanko.shop`, undefined, []);
  }
  for (const f of r.folders ?? []) {
    const dir = `/home/${f.user}/Maildir`;
    const box = w.maildirs.get(dir) ?? new Map<string, Stored[]>([["INBOX", []]]);
    if (!box.has(f.folder)) box.set(f.folder, []);
    w.maildirs.set(dir, box);
  }
  return new MailLab({ world: w });
}

/* ------------------------------------------------------------ 小物 */

/** 返事の中に、その文字をふくむ行があるか */
const has = (r: Run, text: string) => r.out.some((l) => l.text.includes(text));
const ok = (r: Run) => r.exit === 0;
/** ネットワークに、パスワード（平文か base64）が流れたか */
const leaked = (r: Run) => r.packets.some((p) => p.secretText);
const running = (lab: MailLab) => lab.world.pf?.conf ?? null;

const SV = "--server mail.wanko.shop";
const AUTH = (user: keyof typeof MAIL_PW, pw: string = MAIL_PW[user]) => `--auth --auth-user ${user} --auth-password '${pw}'`;
const FROM_OUT = "--from guest@example.net";
const CURL = (user: keyof typeof MAIL_PW) => `curl -u '${user}:${MAIL_PW[user]}'`;

/* ------------------------------------------------------------ カード */

export const MAIL_CARDS: MailCard[] = [
  /* 0. はじめに ---------------------------------------------------------- */
  {
    id: "mail-basics",
    no: 0,
    chapter: 0,
    icon: "queue",
    color: "#67e8f9",
    title: "メールはどう届く？",
    sub: "MX・SMTP・キュー・IMAP",
    intro:
      "メールは、手紙のように **いくつかのサーバーを順に** わたって届きます。送るのは **SMTP**（Postfix・sendmail が受けもつ **MTA**）、メールボックスにしまうのは **MDA**、読むのは **IMAP・POP3**（ここでは Dovecot）。まずは1通送って、届いて、読むまでを見てみよう。",
    analogy: "郵便ポスト（SMTP で受けとる）→ 郵便局の仕分け（キュー）→ 家の郵便受け（メールボックス）→ 家の人が取りだす（IMAP）。",
    build: (seed) => scenario(seed, {}),
    steps: [
      {
        say: "wanko.shop あてのメールは、どのサーバーに届ければいい？ DNS の **MX**（メールの届け先）を聞こう。",
        host: "pc",
        cmd: "dig MX wanko.shop",
        phase: "learn",
        ok: (r) => ok(r) && has(r, "mail.wanko.shop"),
        learn: "**MX** は「このドメインあてのメールは、このサーバーへ」という DNS の決まり。10 は優先度（小さいほど先）。送る側のサーバーは、まずこれを聞きます。",
      },
      {
        say: "店長の pochi から、副店長の hana へ1通送ろう。**swaks** は、SMTP のやりとりをぜんぶ見せてくれる送信の道具です。",
        host: "pc",
        cmd: `swaks --to hana@wanko.shop --from pochi@wanko.shop ${SV} --header 'Subject: 朝礼' --body '10時から朝礼です'`,
        phase: "learn",
        ok: (r) => ok(r) && has(r, "queued as"),
        learn:
          "-> があなた、<- がサーバー。EHLO（あいさつ）→ MAIL FROM（差出人）→ RCPT TO（あて先）→ DATA（中身）の順です。MAIL FROM・RCPT TO は **封筒（エンベロープ）**、DATA の中の From:・To: は **便せん（ヘッダー）**。最後の **250 … queued as** は「あずかった（キューに入れた）」という意味です。",
        show: ["trace", "packets"],
      },
      {
        say: "メールサーバーの中で、何が起きたかを **ログ**（/var/log/maillog）で見よう。",
        host: "mail",
        cmd: "tail -n 7 /var/log/maillog",
        phase: "learn",
        ok: (r) => ok(r) && has(r, "status=sent"),
        learn: "smtpd（受けとる）→ cleanup（整える）→ qmgr（キュー）→ local（配る）の順に、Postfix の中の別々のプログラムが受けついでいます。同じ **キューID** でつながっているので、1通の流れをたどれます。**status=sent** が「配った」です。",
        show: ["logs"],
      },
      {
        say: "hana のパソコンのつもりで、届いたメールを **IMAP** で読もう。imaps:// は、はじめから暗号のつなぎ方です。",
        host: "pc",
        cmd: `${CURL("hana")} 'imaps://mail.wanko.shop/INBOX;UID=1'`,
        phase: "learn",
        ok: (r) => ok(r) && has(r, "朝礼"),
        learn: "届きました。上に **Received:**（どのサーバーを通ったか）・**Delivered-To:** などが足されています。メールは Dovecot が hana の **メールボックス**（~/Maildir）から出しています。",
        show: ["boxes"],
      },
      {
        say: "いない人あてに送ると、どうなるかな？",
        host: "out",
        cmd: `swaks --to dareka@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "learn",
        ok: (r) => r.exit === 24 && has(r, "550"),
        learn: "**550 5.1.1 User unknown**。SMTP の返事は3けたの番号で、**2xx は成功、4xx は「あとでもう一度」、5xx は「だめ」**。5.1.1 のような細かい番号もつきます。",
        show: ["trace"],
      },
      {
        say: "Postfix のふるまいは **/etc/postfix/main.cf** の設定で決まります。**postconf** で、いまの値をのぞこう。",
        host: "mail",
        cmd: "postconf mydestination mynetworks home_mailbox",
        phase: "learn",
        ok,
        learn: "mydestination（自分あてのドメイン）・mynetworks（信用するネットワーク）・home_mailbox（どこにしまうか）。このあとのカードで、こうした設定を1つずつ「なし」と「あり」でくらべます。",
        show: ["config"],
      },
    ],
    words: [
      { term: "MTA", mean: "メールを運ぶサーバー（Postfix・sendmail・Exim）。SMTP で話す" },
      { term: "MDA", mean: "メールボックスにしまう係（Postfix の local・Dovecot の LMTP）" },
      { term: "MUA", mean: "メールを読み書きするアプリ（Thunderbird など）" },
      { term: "MX", mean: "DNS の「このドメインのメールの届け先」" },
      { term: "エンベロープ", mean: "MAIL FROM・RCPT TO（封筒）。ヘッダーの From:・To: とは別" },
      { term: "キュー", mean: "あずかったメールの待ち場所。mailq で見る" },
      { term: "応答コード", mean: "2xx 成功・4xx あとで・5xx だめ（250・550・554 など）" },
      { term: "IMAP・POP3", mean: "メールボックスを読む（IMAP はサーバーに残す、POP3 は持ってくる）" },
    ],
    tries: [
      { label: "MX を聞く", host: "pc", cmd: "dig MX wanko.shop" },
      { label: "hana に送る", host: "pc", cmd: `swaks --to hana@wanko.shop --from pochi@wanko.shop ${SV}` },
      { label: "フォルダー一覧", host: "pc", cmd: `${CURL("hana")} imaps://mail.wanko.shop/` },
      { label: "POP3 で見る", host: "pc", cmd: `${CURL("hana")} pop3s://mail.wanko.shop/` },
      { label: "ログ", host: "mail", cmd: "tail -n 8 /var/log/maillog" },
      { label: "使えるコマンド", host: "mail", cmd: "help" },
    ],
    summary: ["あて先のサーバーは DNS の MX で決まる", "送るのは SMTP（EHLO → MAIL FROM → RCPT TO → DATA）", "250 queued は「あずかった」。配るのはそのあと", "応答コードは 2xx 成功・4xx あとで・5xx だめ", "読むのは IMAP・POP3（Dovecot）"],
    quiz: {
      q: "SMTP の返事が「554 5.7.1 …」だった。どういう意味？",
      choices: ["うまくいった", "あとでもう一度ためせば通るかもしれない", "このままでは受けとれない（だめ）"],
      answer: 2,
      explain: "5 で始まる返事は「だめ（永久的なエラー）」。4 で始まると「いまはだめ、あとでもう一度」、2 は成功です。",
    },
  },

  /* 1. mydestination ------------------------------------------------------ */
  {
    id: "mydest",
    no: 1,
    chapter: 1,
    icon: "dns",
    color: "#ffc857",
    title: "自分あてのドメインは？",
    sub: "mydestination — どのドメインを受けとるか",
    intro:
      "Postfix は、あて先のドメインが **mydestination** にあると「**自分あて**」として受けとります。はじめの値は「$myhostname（mail.wanko.shop）・localhost」だけ。お店のアドレス **pochi@wanko.shop** は、まだ「自分あて」ではありません。",
    analogy: "郵便受けに「わんこ商店」の名札がなくて、「mail 号室」の名札しかない。お店あての手紙は、よそあてだと思われてしまう。",
    knob: {
      ref: "mydest",
      title: "mydestination に $mydomain",
      where: "/etc/postfix/main.cf",
      off: "mail.wanko.shop・localhost だけ",
      on: "wanko.shop も自分あて",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfIsLocalConf(c, "wanko.shop"));
      },
    },
    build: (seed) => scenario(seed, { main: { mydestination: "$myhostname, localhost.$mydomain, localhost" } }),
    steps: [
      {
        say: "外のお客さんのつもりで、外のサーバーから **pochi@wanko.shop** あてに送ろう。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "off",
        ok: (r) => r.exit === 24 && has(r, "Relay access denied"),
        learn: "**554 Relay access denied**（中継おことわり）。wanko.shop が mydestination にないので、Postfix は「よそのドメインあて＝中継をたのまれた」と考え、知らない相手なので断りました。",
        show: ["trace", "logs"],
      },
      {
        say: "**pochi@mail.wanko.shop**（サーバーの名前のほう）あてなら？",
        host: "out",
        cmd: `swaks --to pochi@mail.wanko.shop ${FROM_OUT} ${SV}`,
        phase: "off",
        ok,
        learn: "こちらは届きました。mail.wanko.shop は $myhostname なので、mydestination に入っているからです。",
      },
      {
        say: "mydestination に **$mydomain**（wanko.shop）を足そう。**postconf -e** は main.cf を書きかえるコマンドです。",
        host: "mail",
        cmd: "postconf -e 'mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain'",
        phase: "apply",
        ok,
        learn: "main.cf を書きかえました（postconf -e は、うまくいくと何も出しません）。",
        show: ["config"],
      },
      {
        say: "書いただけで効くかな？ もう一度、外から pochi@wanko.shop に送ってみよう。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "apply",
        prep: false,
        ok: (r) => r.exit === 24,
        learn: "まだ断られます。**動いている Postfix は、起動したとき（reload したとき）の main.cf のまま** だからです。",
        show: ["config"],
        why: "postfix:running",
      },
      {
        say: "**postfix reload** で、main.cf を読みこませよう。",
        host: "mail",
        cmd: "postfix reload",
        phase: "apply",
        ok,
        learn: "読みこみました。止めずに設定だけ入れかえるので、いまつながっている人のじゃまをしません。",
        show: ["logs"],
      },
      {
        say: "もう一度、外から pochi@wanko.shop に送ろう。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "on",
        ok,
        retry: "まだ断られました。postconf -e と postfix reload をしたか確かめよう。",
        learn: "**250** で受けとりました。wanko.shop が「自分あて」になったので、中継ではなく、pochi のメールボックスに配っています。",
        show: ["trace", "logs"],
      },
      {
        say: "$ のついた値を、ひらいて見よう（-x）。",
        host: "mail",
        cmd: "postconf -x mydestination",
        phase: "on",
        ok: (r) => ok(r) && has(r, "wanko.shop"),
        learn: "$myhostname・$mydomain が、本当の名前に置きかわりました。main.cf ではこうして、ほかの設定の値を $ で使えます。",
      },
    ],
    probe: { host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`, label: (r) => (ok(r) ? "pochi@wanko.shop が受けとれた" : "よそあてとみなして断った") },
    compare: [
      { head: "pochi@wanko.shop あて", off: "554 Relay access denied", on: "250（受けとる）" },
      { head: "pochi@mail.wanko.shop あて", off: "250", on: "250" },
      { head: "効かせるには", off: "—", on: "postconf -e → postfix reload" },
    ],
    tries: [
      { label: "wanko.shop あて", host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}` },
      { label: "いまの値", host: "mail", cmd: "postconf mydestination" },
      { label: "$ をひらく", host: "mail", cmd: "postconf -x mydestination" },
      { label: "初めの値", host: "mail", cmd: "postconf -d mydestination" },
      { label: "書いた設定", host: "mail", cmd: "postconf -n" },
      { label: "reload", host: "mail", cmd: "postfix reload" },
    ],
    summary: ["mydestination にあるドメインは「自分あて」として受けとる", "ないドメインは「中継」あつかい（知らない相手なら 554）", "postconf -e で main.cf を書き、postfix reload で読みこむ", "$myhostname・$mydomain のように、ほかの値を $ で使える"],
    quiz: {
      q: "postconf -e で mydestination を書きかえたのに、まだ 554 になる。なぜ？",
      choices: ["newaliases をしていない", "postfix reload をしていない", "DNS の MX がない"],
      answer: 1,
      explain: "postconf -e は main.cf（ファイル）を書くだけ。動いている Postfix に読みこませるには postfix reload が要ります。",
    },
  },

  /* 2. aliases ------------------------------------------------------------ */
  {
    id: "aliases",
    no: 2,
    chapter: 1,
    icon: "lb",
    color: "#b08cff",
    title: "info@ をみんなに",
    sub: "/etc/aliases と newaliases — 別名で届ける",
    intro:
      "お店のホームページに **info@wanko.shop** と書きたい。でも info という人はいません。**/etc/aliases** に「info あてのメールは pochi と hana に」と書くと、**別名（エイリアス）** として届けられます。",
    analogy: "「お問い合わせ係」あての手紙を、店長と副店長の2人の郵便受けに配る、という配り方のメモ。",
    knob: {
      ref: "aliases",
      title: "info: pochi, hana",
      where: "/etc/aliases → /etc/aliases.db",
      off: "info はいない",
      on: "info → pochi・hana",
      isOn: (lab) => Boolean(lab.world.aliasDb?.has("info")),
    },
    build: (seed) => scenario(seed, {}),
    steps: [
      {
        say: "外から **info@wanko.shop** に問い合わせを送ってみよう。",
        host: "out",
        cmd: `swaks --to info@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: お問い合わせ'`,
        phase: "off",
        ok: (r) => r.exit === 24 && has(r, "User unknown"),
        learn: "**550 User unknown in local recipient table**。info というユーザーも、別名もないので、RCPT TO の時点で断りました。",
        show: ["trace"],
      },
      {
        say: "/etc/aliases に、別名の行を足そう。",
        host: "mail",
        cmd: "echo 'info: pochi, hana' >> /etc/aliases",
        phase: "apply",
        ok,
        learn: "/etc/aliases の最後に1行足しました。「名前: 届け先, 届け先」の形です。",
        show: ["config"],
      },
      {
        say: "書いただけで届くかな？ もう一度、外から info@ に送ろう。",
        host: "out",
        cmd: `swaks --to info@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: お問い合わせ'`,
        phase: "apply",
        prep: false,
        ok: (r) => r.exit === 24,
        learn: "まだ 550。Postfix が読むのは /etc/aliases（文字のファイル）ではなく、**/etc/aliases.db**（速く引ける形にしたファイル）だからです。",
        show: ["config", "trace"],
        why: "aliases:db",
      },
      {
        say: "**newaliases** で、aliases.db を作りなおそう。",
        host: "mail",
        cmd: "newaliases",
        phase: "apply",
        ok,
        learn: "aliases.db を作りなおしました（何も出さないのが成功）。.db は毎回読みにいくので、postfix reload はいりません。",
        show: ["config"],
      },
      {
        say: "もう一度、外から info@ に送ろう。",
        host: "out",
        cmd: `swaks --to info@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: お問い合わせ'`,
        phase: "on",
        ok,
        retry: "まだ断られました。newaliases をしたか確かめよう。",
        learn: "250 で受けとりました。ログを見ると、pochi と hana の2人に **orig_to=<info@wanko.shop>** つきで配っています。",
        show: ["logs", "boxes"],
      },
      {
        say: "aliases.db の中で info を引いてみよう。",
        host: "mail",
        cmd: "postalias -q info /etc/aliases",
        phase: "on",
        ok: (r) => ok(r) && has(r, "pochi"),
        learn: "pochi, hana が返ってきました。postalias -q は、.db に本当に入っているかを確かめるときに使います。",
      },
    ],
    probe: { host: "out", cmd: `swaks --to info@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: お問い合わせ'`, label: (r) => (ok(r) ? "info@ が pochi と hana に届いた" : "info という人はいない") },
    compare: [
      { head: "info@wanko.shop あて", off: "550 User unknown", on: "pochi・hana に届く" },
      { head: "Postfix が読むもの", off: "/etc/aliases.db", on: "/etc/aliases.db（newaliases で作る）" },
      { head: "効かせるには", off: "—", on: "/etc/aliases を書く → newaliases" },
    ],
    tries: [
      { label: "info@ に送る", host: "out", cmd: `swaks --to info@wanko.shop ${FROM_OUT} ${SV}` },
      { label: "aliases を見る", host: "mail", cmd: "cat /etc/aliases" },
      { label: "info を引く", host: "mail", cmd: "postalias -q info /etc/aliases" },
      { label: "postmaster を引く", host: "mail", cmd: "postalias -q postmaster /etc/aliases" },
      { label: "pochi のメール", host: "mail", cmd: "doveadm mailbox status -u pochi messages INBOX" },
    ],
    summary: ["/etc/aliases に「名前: 届け先, …」で別名を書く", "Postfix・sendmail が読むのは aliases.db。newaliases で作る", ".db は毎回読むので、reload はいらない", "postmaster・abuse などは root への別名にしておく決まり"],
    quiz: {
      q: "/etc/aliases に別名を書いたあと、かならずやることは？",
      choices: ["newaliases", "postfix stop", "dig MX"],
      answer: 0,
      explain: "newaliases（postalias /etc/aliases・sendmail -bi も同じ）で aliases.db を作りなおします。書いただけでは効きません。",
    },
  },

  /* 3. mynetworks ---------------------------------------------------------- */
  {
    id: "relay",
    no: 3,
    chapter: 2,
    icon: "waf",
    color: "#9fb4ff",
    title: "だれのメールを中継する？",
    sub: "mynetworks と smtpd_relay_restrictions",
    intro:
      "お店のパソコンから、友だちのお店（example.com）にメールを送りたい。よそのドメインあてのメールを、つぎのサーバーへ運ぶことを **中継（リレー）** といいます。Postfix は **mynetworks** にあるネットワークからのメールだけを中継します。はじめの mynetworks は、サーバー自身だけです。",
    analogy: "郵便局の窓口が「この町内の人の手紙だけ、よその町へ運びます」と決めている。町内の名簿（mynetworks）にない人の手紙は運ばない。",
    knob: {
      ref: "relay:mynetworks",
      title: "mynetworks に 192.168.10.0/24",
      where: "/etc/postfix/main.cf",
      off: "サーバー自身だけ",
      on: "お店の LAN も信用する",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfGet(c, "mynetworks").split(/[\s,]+/).some((n) => inCidr(HOST_IP.pc, n)));
      },
    },
    build: (seed) => scenario(seed, {}),
    steps: [
      {
        say: "お店のパソコンから、友だちのお店の **tomodachi@example.com** に送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`,
        phase: "off",
        ok: (r) => r.exit === 24 && has(r, "Relay access denied"),
        learn: "**554 Relay access denied**。example.com は自分あてではないので中継になりますが、あなたのパソコン（192.168.10.5）は mynetworks に入っていないので断られました。",
        show: ["trace"],
      },
      {
        say: "いまの mynetworks と、中継の決まり（smtpd_relay_restrictions）を見よう。",
        host: "mail",
        cmd: "postconf mynetworks smtpd_relay_restrictions",
        phase: "off",
        ok,
        learn: "決まりは **左から順に** 見ます。permit_mynetworks（mynetworks なら通す）→ permit_sasl_authenticated（ログインした人なら通す）→ **reject_unauth_destination**（どちらでもなく、自分あてでもなければ断る）。",
        show: ["config"],
      },
      {
        say: "お店の LAN（192.168.10.0/24）を mynetworks に足して、読みこませよう。",
        host: "mail",
        cmd: "postconf -e 'mynetworks = 127.0.0.0/8, 192.168.10.0/24' && postfix reload",
        phase: "apply",
        ok,
        learn: "&& は「前がうまくいったら、つぎも」。書いて、すぐ reload しました。",
        show: ["config"],
      },
      {
        say: "もう一度、お店のパソコンから example.com に送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`,
        phase: "on",
        ok,
        retry: "まだ断られました。mynetworks を書いて reload したか確かめよう。",
        learn: "250 で受けとり、mx.example.com へ運びました（ログの relay=mx.example.com・status=sent）。permit_mynetworks で通ったからです。",
        show: ["trace", "logs"],
      },
      {
        say: "外のサーバー（お店の LAN ではない）から、同じように example.com あてをたのまれたら？",
        host: "out",
        cmd: `swaks --to tomodachi@example.com ${FROM_OUT} ${SV}`,
        phase: "on",
        ok: (r) => r.exit === 24 && has(r, "Relay access denied"),
        learn: "外からの中継は、いままでどおり **554** で断ります。ログの **NOQUEUE: reject: RCPT from …** の行が、断った記録です。mynetworks は「信用する範囲」なので、必要なところだけにします（広げすぎると、知らない人のメールまで運んでしまう）。",
        show: ["logs", "trace"],
        why: "relay",
      },
      {
        say: "落とし穴：mynetworks を広げたり絞ったりすると、外からお店あてのメールは届かなくなる？",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "trap",
        ok,
        learn: "届きます。mynetworks・reject_unauth_destination は **中継（よそあて）** の決まり。**自分あて**（mydestination）は、だれからでも受けとります。「受けとる」と「運ぶ」は別の話です。",
        show: ["trace"],
        why: "mydest",
      },
    ],
    probe: { host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`, label: (r) => (ok(r) ? "お店のパソコンからの中継を引きうけた" : "お店のパソコンでも中継しない") },
    compare: [
      { head: "お店の LAN → example.com", off: "554 Relay access denied", on: "250（中継する）" },
      { head: "外 → example.com", off: "554", on: "554（いままでどおり断る）" },
      { head: "外 → wanko.shop（自分あて）", off: "250", on: "250" },
    ],
    tries: [
      { label: "LAN から外へ", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}` },
      { label: "外から外へ", host: "out", cmd: `swaks --to tomodachi@example.com ${FROM_OUT} ${SV}` },
      { label: "中継の決まり", host: "mail", cmd: "postconf smtpd_relay_restrictions" },
      { label: "初めの mynetworks", host: "mail", cmd: "postconf -d mynetworks_style mynetworks" },
      { label: "断った記録", host: "mail", cmd: "grep reject /var/log/maillog" },
    ],
    summary: ["よそのドメインあては「中継」。だれでも引きうけてはいけない", "mynetworks のネットワークからは中継する（permit_mynetworks）", "smtpd_relay_restrictions は左から順に、最初に決まったもので決まる", "reject_unauth_destination が、知らない相手の中継を 554 で断る", "自分あて（mydestination）は、だれからでも受けとる"],
    quiz: {
      q: "reject_unauth_destination は、どんなメールを断る？",
      choices: ["自分あてのメールぜんぶ", "自分あてでもなく、中継してよい相手（mynetworks・ログイン）からでもないメール", "添付ファイルのあるメール"],
      answer: 1,
      explain: "自分あて（mydestination・relay_domains）でもなく、その前の permit_… で通らなかったメールを、554 Relay access denied で断ります。",
    },
  },

  /* 4. SMTP AUTH ------------------------------------------------------------ */
  {
    id: "sasl",
    no: 4,
    chapter: 2,
    icon: "user",
    color: "#ffc857",
    title: "ログインして送る",
    sub: "SMTP AUTH（SASL）— Dovecot にパスワードを確かめてもらう",
    intro:
      "家や出先のパソコンは、お店の LAN（mynetworks）の外です。それでも店長が送れるように、**SMTP AUTH**（名前とパスワードでログインしてから送る）を入れます。Postfix はパスワードを自分では確かめず、**Dovecot**（smtpd_sasl_type = dovecot）にたのみます。",
    analogy: "町の外に住んでいても、社員証を見せた人の手紙は運ぶ、という窓口。",
    knob: {
      ref: "sasl",
      title: "smtpd_sasl_auth_enable = yes",
      where: "/etc/postfix/main.cf（＋ Dovecot の private/auth）",
      off: "ログインできない",
      on: "ログインした人の中継をする",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfGet(c, "smtpd_sasl_auth_enable") === "yes");
      },
    },
    build: (seed) => scenario(seed, {}),
    steps: [
      {
        say: "pochi の名前とパスワードでログインして、example.com に送ってみよう（**--auth**）。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`,
        phase: "off",
        ok: (r) => r.exit === 28,
        learn: "**Host did not advertise authentication**。EHLO の返事に **AUTH** がない＝このサーバーはログインを受けつけていません。",
        show: ["trace"],
      },
      {
        say: "Postfix に、Dovecot を使った SMTP AUTH を入れよう（Dovecot の受け口 private/auth は、10-master.conf に用意してあります）。",
        host: "mail",
        cmd: "postconf -e 'smtpd_sasl_type = dovecot' 'smtpd_sasl_path = private/auth' 'smtpd_sasl_auth_enable = yes' && postfix reload",
        phase: "apply",
        ok,
        learn: "3つ書いて reload しました。smtpd_sasl_type（だれに聞くか）・smtpd_sasl_path（どこに聞くか）・smtpd_sasl_auth_enable（AUTH を出すか）。",
        show: ["config"],
      },
      {
        say: "もう一度、ログインして送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`,
        phase: "on",
        ok,
        retry: "まだ送れませんでした。postconf -e と reload を確かめよう。",
        learn: "EHLO に **AUTH PLAIN LOGIN** が出て、**235 Authentication successful** → 中継できました。smtpd_relay_restrictions の **permit_sasl_authenticated** で通っています。",
        show: ["trace", "logs"],
      },
      {
        say: "パスワードをまちがえると？",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi", "machigai")}`,
        phase: "on",
        ok: (r) => r.exit === 28 && has(r, "535"),
        learn: "**535 authentication failed**。ログにも SASL PLAIN authentication failed が残ります。",
        show: ["logs"],
      },
      {
        say: "落とし穴：ログインできたとき、ネットワークには何が流れていた？ もう一度送って、**パケット** を見よう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`,
        phase: "trap",
        ok: (r) => ok(r) && leaked(r),
        learn: "AUTH PLAIN のうしろの文字は **base64**。暗号ではなく、だれでも元にもどせます（\\0pochi\\0Pochi#2026）。SMTP AUTH は「ログインのしくみ」で、「かくすしくみ」ではありません。つぎのカードの **TLS** といっしょに使います。",
        show: ["packets"],
      },
    ],
    probe: { host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`, label: (r) => (ok(r) ? "ログインして送れた" : "ログインできない") },
    compare: [
      { head: "EHLO の返事", off: "AUTH がない", on: "AUTH PLAIN LOGIN" },
      { head: "ログインして外へ", off: "送れない", on: "235 → 中継する" },
      { head: "パスワード", off: "—", on: "Dovecot が確かめる（base64 で流れる）" },
    ],
    tries: [
      { label: "ログインして送る", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}` },
      { label: "AUTH LOGIN で", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --auth LOGIN --auth-user pochi --auth-password '${MAIL_PW.pochi}'` },
      { label: "パスワードを確かめる", host: "mail", cmd: `doveadm auth test pochi '${MAIL_PW.pochi}'` },
      { label: "SASL の設定", host: "mail", cmd: "postconf smtpd_sasl_auth_enable smtpd_sasl_type smtpd_sasl_path" },
      { label: "Dovecot の受け口", host: "mail", cmd: "cat /etc/dovecot/conf.d/10-master.conf" },
    ],
    summary: ["SMTP AUTH で、LAN の外からもログインして送れる", "Postfix は smtpd_sasl_type = dovecot で、Dovecot にパスワードを聞く", "ログインした人は permit_sasl_authenticated で中継できる", "AUTH PLAIN は base64。暗号ではないので TLS とセットで"],
    quiz: {
      q: "AUTH PLAIN で送られる「AHBvY2hpAFBvY2hpIzIwMjY=」は？",
      choices: ["強い暗号なので読めない", "base64 なので、だれでも元の名前とパスワードにもどせる", "パスワードのハッシュ"],
      answer: 1,
      explain: "base64 は文字の形を変えただけ。暗号ではないので、TLS（STARTTLS）の中で使います。",
    },
  },

  /* 5. TLS -------------------------------------------------------------------- */
  {
    id: "smtp-tls",
    no: 5,
    chapter: 2,
    icon: "cdn",
    color: "#34d6b8",
    title: "暗号にしてから送る",
    sub: "smtpd_tls_* と smtpd_tls_auth_only — STARTTLS",
    intro:
      "SMTP は、ふつうは暗号なしで始まります。**STARTTLS** と言うと、そこから先が暗号になります。Postfix に証明書と **smtpd_tls_security_level** を入れ、さらに **smtpd_tls_auth_only = yes** で「暗号にするまでログインさせない」ようにしよう。",
    analogy: "はがき（だれでも読める）で送っていたのを、ふうとう（中が見えない）に入れてから送るようにする。",
    knob: {
      ref: "tls",
      title: "smtpd_tls_security_level = may（＋ auth_only）",
      where: "/etc/postfix/main.cf",
      off: "STARTTLS なし",
      on: "STARTTLS あり・暗号の中でだけログイン",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && ["may", "encrypt"].includes(pfGet(c, "smtpd_tls_security_level")) && pfGet(c, "smtpd_tls_cert_file"));
      },
    },
    build: (seed) => scenario(seed, { main: { smtpd_sasl_type: "dovecot", smtpd_sasl_path: "private/auth", smtpd_sasl_auth_enable: "yes" } }),
    steps: [
      {
        say: "pochi でログインして送り、**パケット** を見よう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`,
        phase: "off",
        ok: (r) => ok(r) && leaked(r),
        learn: "送れたけれど、パスワード（base64）も、メールの中身も、そのまま流れています。同じネットワークにいる人なら読めてしまいます。",
        show: ["packets"],
      },
      {
        say: "**--tls**（暗号にできなければ送らない）をつけてみよう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --tls ${AUTH("pochi")}`,
        phase: "off",
        ok: (r) => r.exit === 29,
        learn: "**STARTTLS not advertised**。EHLO の返事に STARTTLS がないので、暗号にできません。",
        show: ["trace"],
      },
      {
        say: "証明書と TLS の設定を入れて、読みこませよう。",
        host: "mail",
        cmd: "postconf -e 'smtpd_tls_cert_file = /etc/pki/tls/certs/mail.crt' 'smtpd_tls_key_file = /etc/pki/tls/private/mail.key' 'smtpd_tls_security_level = may' 'smtpd_tls_auth_only = yes' && postfix reload",
        phase: "apply",
        ok,
        learn: "**may** は「相手ができるなら暗号に」。**smtpd_tls_auth_only = yes** は「暗号になるまで AUTH を見せない」。",
        show: ["config"],
      },
      {
        say: "--tls をつけずに、ログインして送ってみよう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`,
        phase: "on",
        ok: (r) => r.exit === 28 && !leaked(r),
        learn: "EHLO に **STARTTLS** は出たけれど、**AUTH は出ません**（smtpd_tls_auth_only）。暗号なしでパスワードを送る道が、なくなりました。",
        show: ["trace"],
      },
      {
        say: "こんどは **--tls** をつけて送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --tls ${AUTH("pochi")}`,
        phase: "on",
        ok: (r) => ok(r) && !leaked(r),
        retry: "まだうまくいきません。TLS の設定を入れて reload したか確かめよう。",
        learn: "STARTTLS → 220 Ready to start TLS のあとは、~> と <~（暗号の中）。パケットはぜんぶ **Application Data** になり、パスワードも中身も読めません。",
        show: ["packets", "logs"],
      },
      {
        say: "落とし穴：外のサーバーが、暗号を使わずに pochi@wanko.shop へ送ってきたら？",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "trap",
        ok,
        learn: "受けとりました（暗号なし）。**may** は「できれば」なので、STARTTLS をしない相手も断りません。25番でよそのサーバーから受けとるときは may がふつう（encrypt にすると、TLS を使えない相手からのメールが届かなくなる）。ログインして送る 587番（submission）は encrypt にします。",
        show: ["trace", "packets"],
        why: "tls:may",
      },
    ],
    probe: { host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}`, label: (r) => (r.packets.some((p) => p.secretText) ? "パスワードが base64 のまま流れた" : "暗号の外ではログインさせない") },
    compare: [
      { head: "EHLO の返事", off: "STARTTLS なし・AUTH あり", on: "STARTTLS あり・AUTH は暗号のあと" },
      { head: "パスワード・中身", off: "そのまま流れる", on: "暗号（読めない）" },
      { head: "暗号なしの相手から受けとる", off: "受けとる", on: "受けとる（may は「できれば」）" },
    ],
    tries: [
      { label: "暗号で送る", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --tls ${AUTH("pochi")}` },
      { label: "暗号なしで送る", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} ${AUTH("pochi")}` },
      { label: "TLS の設定", host: "mail", cmd: "postconf smtpd_tls_security_level smtpd_tls_auth_only smtpd_tls_cert_file" },
      { label: "587番は？", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --port 587` },
      { label: "master.cf", host: "mail", cmd: "cat /etc/postfix/master.cf" },
    ],
    summary: ["STARTTLS で、つながったあとから暗号にする", "smtpd_tls_cert_file・key_file・security_level（may／encrypt）", "smtpd_tls_auth_only = yes で、暗号の外ではログインさせない", "25番の受けとりは may、ログインして送る 587番は encrypt"],
    quiz: {
      q: "smtpd_tls_security_level = may の意味は？",
      choices: ["かならず暗号。できない相手は断る", "相手ができれば暗号にする。できなくても受けとる", "暗号を使わない"],
      answer: 1,
      explain: "may は「できれば（opportunistic）」、encrypt は「かならず」。よそのサーバーから受ける25番は may がふつうです。",
    },
  },

  /* 6. Dovecot の平文ログイン ---------------------------------------------- */
  {
    id: "imap-plain",
    no: 6,
    chapter: 2,
    icon: "db",
    color: "#60a5fa",
    title: "読むときも暗号で",
    sub: "Dovecot の disable_plaintext_auth — IMAP・POP3",
    intro:
      "メールを読む IMAP（143番）・POP3（110番）も、はじめは暗号なしです。Dovecot は、ふつうは暗号なしのパスワードでのログインを断ります（**disable_plaintext_auth = yes**）。でもこのサーバーは、だれかが「つながらないから」と **no** にしてしまっています。",
    analogy: "郵便受けのカギの番号を、大きな声で言いながら開けているような状態。",
    knob: {
      ref: "imap",
      title: "disable_plaintext_auth = yes",
      where: "/etc/dovecot/conf.d/10-auth.conf",
      off: "no（暗号なしでもログイン）",
      on: "yes（暗号のときだけ）",
      isOn: (lab) => Boolean(lab.world.dc && lab.world.dc.get("disable_plaintext_auth") === "yes"),
    },
    build: (seed) => scenario(seed, { plain: "no" }),
    steps: [
      {
        say: "hana で、**imap://**（暗号なし）でつないで、フォルダーを見よう。-v で、やりとりも見ます。",
        host: "pc",
        cmd: `curl -v ${CURL("hana").slice(5)} imap://mail.wanko.shop/`,
        phase: "off",
        ok: (r) => ok(r) && leaked(r),
        learn: "ログインできたけれど、**AUTHENTICATE PLAIN** のあとに、名前とパスワード（base64）がそのまま流れています。",
        show: ["packets", "trace"],
      },
      {
        say: "10-auth.conf の no を yes に書きかえよう。",
        host: "mail",
        cmd: "sed -i 's/^disable_plaintext_auth = no/disable_plaintext_auth = yes/' /etc/dovecot/conf.d/10-auth.conf",
        phase: "apply",
        ok,
        learn: "sed -i は、ファイルの中の文字を置きかえます（s/さがす/おきかえ/）。",
        show: ["config"],
      },
      {
        say: "書いただけで効くかな？ もう一度 imap:// でつないでみよう。",
        host: "pc",
        cmd: `curl -v ${CURL("hana").slice(5)} imap://mail.wanko.shop/`,
        phase: "apply",
        prep: false,
        ok: (r) => ok(r),
        learn: "まだ入れてしまいます。動いている Dovecot は、まだ前の設定です。",
        show: ["config"],
        why: "dovecot:running",
      },
      {
        say: "Dovecot に設定を読みこませよう。",
        host: "mail",
        cmd: "systemctl reload dovecot",
        phase: "apply",
        ok,
        learn: "reload しました（doveadm reload でも同じ）。",
        show: ["logs"],
      },
      {
        say: "もう一度 imap://（暗号なし）でつなごう。",
        host: "pc",
        cmd: `curl -v ${CURL("hana").slice(5)} imap://mail.wanko.shop/`,
        phase: "on",
        ok: (r) => r.exit === 67 && !leaked(r),
        retry: "まだ入れてしまいました。sed で書きかえて reload したか確かめよう。",
        learn: "CAPABILITY に **LOGINDISABLED** が出て、AUTH=PLAIN が消えました。パスワードを送る前に止まるので、何も流れていません。",
        show: ["trace", "packets"],
      },
      {
        say: "暗号（**imaps://**、993番）なら入れるはず。",
        host: "pc",
        cmd: `curl -v ${CURL("hana").slice(5)} imaps://mail.wanko.shop/`,
        phase: "on",
        ok: (r) => ok(r) && !leaked(r),
        learn: "入れました。はじめから暗号なので、ログインも読めません（143番でも --ssl-reqd で STARTTLS すれば入れます）。",
        show: ["packets"],
      },
      {
        say: "落とし穴：メールサーバーの中から、**localhost** に imap:// でつないだら？",
        host: "mail",
        cmd: `${CURL("hana")} imap://localhost/`,
        phase: "trap",
        ok,
        learn: "入れました。Dovecot は、同じサーバーの中（127.0.0.1）からのつながりを **secured（安全）** とみなして、平文のログインを通します（同じサーバーで動く Webメールのため）。ネットワークを通らないので、だれにも見られないからです。",
        show: ["trace"],
        why: "imap:local",
      },
    ],
    probe: { host: "pc", cmd: `curl ${CURL("hana").slice(5)} imap://mail.wanko.shop/`, label: (r) => (ok(r) ? "暗号なしでログインできた（パスワードが流れた）" : "暗号なしではログインさせない") },
    compare: [
      { head: "imap://（143番・暗号なし）", off: "ログインできる（パスワードが流れる）", on: "LOGINDISABLED（67 Login denied）" },
      { head: "imaps://（993番）", off: "ログインできる", on: "ログインできる" },
      { head: "サーバーの中（localhost）", off: "ログインできる", on: "ログインできる（secured）" },
    ],
    tries: [
      { label: "暗号なしで", host: "pc", cmd: `curl -v ${CURL("hana").slice(5)} imap://mail.wanko.shop/` },
      { label: "STARTTLS で", host: "pc", cmd: `curl -v --ssl-reqd ${CURL("hana").slice(5)} imap://mail.wanko.shop/` },
      { label: "POP3 暗号なし", host: "pc", cmd: `curl -v ${CURL("hana").slice(5)} pop3://mail.wanko.shop/` },
      { label: "設定を見る", host: "mail", cmd: "doveconf disable_plaintext_auth ssl" },
      { label: "書いた設定ぜんぶ", host: "mail", cmd: "doveconf -n" },
      { label: "ログ", host: "mail", cmd: "tail -n 5 /var/log/maillog" },
    ],
    summary: ["IMAP・POP3 も、暗号なしだとパスワードが流れる", "disable_plaintext_auth = yes で、暗号なしのログインを断る（LOGINDISABLED）", "Dovecot の設定は systemctl reload dovecot で読みこむ", "サーバーの中（localhost）からは secured として通す"],
    quiz: {
      q: "disable_plaintext_auth = yes のとき、imap://（143番）で STARTTLS をしないと？",
      choices: ["ふつうにログインできる", "ログインのしかたが出ない（LOGINDISABLED）", "自動で 993 番につなぎなおす"],
      answer: 1,
      explain: "暗号なしのつながりでは、パスワードでのログインを出しません。STARTTLS か 993番（imaps）を使います。",
    },
  },

  /* 7. Maildir --------------------------------------------------------------- */
  {
    id: "maildir",
    no: 7,
    chapter: 3,
    icon: "backup",
    color: "#ffa45c",
    title: "しまう場所と読む場所",
    sub: "home_mailbox（Postfix）と mail_location（Dovecot）",
    intro:
      "メールのしまい方には、1つのファイルにつなげて書く **mbox**（/var/mail/名前）と、1通1ファイルの **Maildir**（~/Maildir/）があります。Postfix は **home_mailbox** でしまう場所を、Dovecot は **mail_location** で読む場所を決めます。この2つがずれていると…？",
    analogy: "郵便屋さんは玄関の箱に入れているのに、家の人は裏口の箱しか見ていない。",
    knob: {
      ref: "maildir",
      title: "home_mailbox = Maildir/",
      where: "/etc/postfix/main.cf",
      off: "空（/var/mail の mbox）",
      on: "Maildir/（Dovecot と同じ）",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfGet(c, "home_mailbox") === "Maildir/");
      },
    },
    build: (seed) => scenario(seed, { main: { home_mailbox: null }, oldMbox: [{ user: "hana", subject: "先週のシフト", body: "先週のシフト表です" }] }),
    steps: [
      {
        say: "外の取引先から、hana にシフトのメールが来ました。",
        host: "out",
        cmd: `swaks --to hana@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: 新しいシフト'`,
        phase: "off",
        ok,
        learn: "250 で受けとって、配りました（ログは delivered to mailbox）。",
        show: ["logs"],
      },
      {
        say: "hana が IMAP で INBOX をさがすと…？",
        host: "pc",
        cmd: `${CURL("hana")} 'imaps://mail.wanko.shop/INBOX?ALL'`,
        phase: "off",
        ok: (r) => ok(r) && r.out.some((l) => l.text.trim() === "* SEARCH"),
        learn: "*** SEARCH** のうしろに何もない＝INBOX は空っぽ。届いたのに、見えません。",
        show: ["boxes", "trace"],
      },
      {
        say: "Postfix がしまう場所と、Dovecot が読む場所を、ならべて見よう。",
        host: "mail",
        cmd: "postconf home_mailbox ; doveconf mail_location",
        phase: "off",
        ok,
        learn: "Postfix は home_mailbox が空 → **/var/mail/hana（mbox）** にしまう。Dovecot は **~/Maildir** を読む。場所がずれていました。",
        show: ["config"],
      },
      {
        say: "Postfix も Maildir にしまうようにしよう（最後の / が「Maildir の形で」という意味）。",
        host: "mail",
        cmd: "postconf -e 'home_mailbox = Maildir/' && postfix reload",
        phase: "apply",
        ok,
        learn: "home_mailbox = Maildir/ にして reload しました。",
        show: ["config"],
      },
      {
        say: "もう一度、取引先から hana にメールが来ました。",
        host: "out",
        cmd: `swaks --to hana@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: 新しいシフト（2通目）'`,
        phase: "on",
        ok,
        learn: "こんどはログが **delivered to maildir**。/home/hana/Maildir/new/ に1通1ファイルで置かれました。",
        show: ["logs", "boxes"],
      },
      {
        say: "hana が IMAP でさがすと？",
        host: "pc",
        cmd: `${CURL("hana")} 'imaps://mail.wanko.shop/INBOX?ALL'`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "* SEARCH 1"),
        retry: "まだ見えません。home_mailbox を書いて reload したか確かめよう。",
        learn: "*** SEARCH 1**。しまう場所と読む場所がそろって、見えるようになりました。",
        show: ["boxes"],
      },
      {
        say: "落とし穴：さっき見えなかったメールや、前からあったメールはどうなった？",
        host: "mail",
        cmd: "grep Subject: /var/mail/hana",
        phase: "trap",
        ok,
        learn: "**/var/mail/hana に残ったまま** です。設定を変えても、前にしまったメールは動きません。移すには、mbox から Maildir に変える道具（dsync など）を使います。",
        show: ["boxes"],
      },
    ],
    probe: { host: "pc", cmd: `${CURL("hana")} 'imaps://mail.wanko.shop/INBOX?ALL'`, note: "まっさらなサーバーに、取引先からのメールを1通送ってから、hana が IMAP でさがします。", label: (r) => (has(r, "* SEARCH 1") ? "届いたメールが見えた" : "届いたのに見えない") },
    compare: [
      { head: "Postfix がしまう場所", off: "/var/mail/hana（mbox）", on: "~/Maildir/new/（Maildir）" },
      { head: "IMAP で見えるか", off: "見えない（Dovecot は ~/Maildir を見ている）", on: "見える" },
      { head: "前にしまったメール", off: "/var/mail/hana", on: "/var/mail/hana に残ったまま" },
    ],
    tries: [
      { label: "hana に送る", host: "out", cmd: `swaks --to hana@wanko.shop ${FROM_OUT} ${SV}` },
      { label: "IMAP でさがす", host: "pc", cmd: `${CURL("hana")} 'imaps://mail.wanko.shop/INBOX?ALL'` },
      { label: "Maildir の中", host: "mail", cmd: "ls /home/hana/Maildir/new" },
      { label: "mbox の中", host: "mail", cmd: "cat /var/mail/hana" },
      { label: "Dovecot の見る場所", host: "mail", cmd: "doveconf mail_location" },
    ],
    summary: ["mbox は1つのファイル、Maildir は1通1ファイル（new・cur・tmp）", "Postfix の home_mailbox = Maildir/（/ が Maildir のしるし）", "Dovecot の mail_location と、かならず場所をそろえる", "設定を変えても、前のメールは移らない"],
    quiz: {
      q: "home_mailbox = Maildir/ の、最後の / の意味は？",
      choices: ["ただの書きぐせ", "Maildir の形（1通1ファイル）でしまう", "ディレクトリをつくらない"],
      answer: 1,
      explain: "/ で終わると Maildir、/ がないと、そのファイル名の mbox になります。",
    },
  },

  /* 8. Sieve ---------------------------------------------------------------- */
  {
    id: "sieve",
    no: 8,
    chapter: 3,
    icon: "worker",
    color: "#d3c2ff",
    title: "届くときにふり分ける",
    sub: "LMTP と Sieve — mailbox_transport",
    intro:
      "店長の pochi は、件名に [広告] がついたメールを **Ads** フォルダーに分けたくて、**Sieve**（ふり分けのルール）を ~/.dovecot.sieve に書きました。でも、Sieve を読むのは **Dovecot**。Postfix が自分で配っているあいだは、だれも読みません。",
    analogy: "「チラシは別の箱へ」とメモを書いたのに、メモを読む人（Dovecot）に手紙をわたしていない。",
    knob: {
      ref: "sieve:transport",
      title: "mailbox_transport = lmtp:unix:private/dovecot-lmtp",
      where: "/etc/postfix/main.cf",
      off: "Postfix が自分で配る",
      on: "Dovecot（LMTP）に渡す",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfGet(c, "mailbox_transport").startsWith("lmtp:"));
      },
    },
    build: (seed) =>
      scenario(seed, {
        sieve: true,
        folders: [{ user: "pochi", folder: "Ads" }, { user: "hana", folder: "Ads" }],
        files: {
          "/home/pochi/.dovecot.sieve": 'require ["fileinto"];\n# 件名に [広告] があれば Ads フォルダーへ\nif header :contains "subject" "[広告]" {\n  fileinto "Ads";\n}\n',
          "/home/hana/.dovecot.sieve": 'require ["fileinto"];\nif header :contains "subject" "[広告]" {\n  fileint "Ads";\n}\n',
        },
      }),
    steps: [
      {
        say: "外から pochi に、広告のメールが来ました。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: [広告] 秋のセール'`,
        phase: "off",
        ok,
        learn: "250 で受けとって、配りました。",
        show: ["logs"],
      },
      {
        say: "pochi のフォルダーごとの数を見よう。",
        host: "mail",
        cmd: "doveadm mailbox status -u pochi messages '*'",
        phase: "off",
        ok: (r) => ok(r) && has(r, "INBOX messages=1") && has(r, "Ads messages=0"),
        learn: "広告は **INBOX** に入っています。Ads は 0通。Sieve は読まれていません。",
        show: ["boxes", "trace"],
      },
      {
        say: "pochi の Sieve を見てみよう。",
        host: "mail",
        cmd: "cat /home/pochi/.dovecot.sieve",
        phase: "off",
        ok,
        learn: "ルールは正しく書けています。でも Postfix の **local** が配ると、Sieve は通りません。Sieve を読むのは Dovecot の **LMTP**（または LDA）です。",
      },
      {
        say: "Postfix が、ローカルの人へのメールを Dovecot の LMTP に渡すようにしよう。",
        host: "mail",
        cmd: "postconf -e 'mailbox_transport = lmtp:unix:private/dovecot-lmtp' && postfix reload",
        phase: "apply",
        ok,
        learn: "LMTP は、メールを渡すための SMTP のなかま。Dovecot の 20-lmtp.conf で **mail_plugins = $mail_plugins sieve** にしてあるので、LMTP で受けとると Sieve を読みます。",
        show: ["config"],
      },
      {
        say: "もう一度、pochi に広告が来ました。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: [広告] 冬のセール'`,
        phase: "on",
        ok,
        learn: "ログが postfix/**lmtp** … Saved と、dovecot: lmtp(pochi) … **stored mail into mailbox 'Ads'** になりました。",
        show: ["logs", "trace"],
      },
      {
        say: "フォルダーごとの数をもう一度。",
        host: "mail",
        cmd: "doveadm mailbox status -u pochi messages '*'",
        phase: "on",
        ok: (r) => ok(r) && has(r, "Ads messages=1"),
        retry: "まだ Ads に入っていません。mailbox_transport を書いて reload したか確かめよう。",
        learn: "Ads に1通。Sieve のルールどおりに、ふり分けられました。",
        show: ["boxes"],
      },
      {
        say: "落とし穴：hana も同じルールを書いたつもり。hana に広告が来たら？（先に送ってから、ログで sieve の行をさがします）",
        host: "mail",
        pre: { host: "out", cmd: `swaks --to hana@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: [広告] 冬のセール'` },
        cmd: "grep sieve /var/log/maillog",
        phase: "trap",
        ok: (r) => ok(r) && has(r, "sieve"),
        learn: "hana の Sieve は **fileint**（書きまちがい）。Dovecot はスクリプトを読めず、**エラーをログに書いて、だまって INBOX に入れました**。メールはなくならないけれど、ふり分けもされません。Sieve を書いたら、ログを見るくせを。",
        show: ["logs", "trace"],
      },
    ],
    probe: { host: "mail", cmd: "doveadm mailbox status -u pochi messages '*'", note: "まっさらなサーバーに、pochi あての広告を1通送ってから数えます。", label: (r) => (has(r, "Ads messages=1") ? "広告が Ads にふり分けられた" : "広告も INBOX に入った") },
    compare: [
      { head: "だれが配るか", off: "Postfix の local", on: "Dovecot の LMTP" },
      { head: "Sieve", off: "読まれない", on: "読まれる（[広告] → Ads）" },
      { head: "Sieve の書きまちがい", off: "—", on: "ログにエラー、INBOX に入る" },
    ],
    tries: [
      { label: "広告を送る", host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: [広告] セール'` },
      { label: "ふつうのメール", host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: こんにちは'` },
      { label: "フォルダーの数", host: "mail", cmd: "doveadm mailbox status -u pochi messages '*'" },
      { label: "件名の一覧", host: "mail", cmd: "doveadm fetch -u pochi hdr.subject mailbox Ads" },
      { label: "LMTP の設定", host: "mail", cmd: "cat /etc/dovecot/conf.d/20-lmtp.conf" },
      { label: "hana の Sieve", host: "mail", cmd: "cat /home/hana/.dovecot.sieve" },
    ],
    summary: ["Sieve は、届くときにふり分けるルール（fileinto・discard など）", "Sieve を読むのは Dovecot（LMTP・LDA の sieve プラグイン）", "Postfix の mailbox_transport = lmtp:… で Dovecot に渡す", "書きまちがいは、ログにエラーを書いて INBOX に入る"],
    quiz: {
      q: "~/.dovecot.sieve を書いたのに、ふり分けられない。いちばんありそうなのは？",
      choices: ["メールを Postfix の local が配っていて、Dovecot が読んでいない", "DNS の MX がない", "newaliases をしていない"],
      answer: 0,
      explain: "Sieve は Dovecot の LMTP・LDA で読まれます。mailbox_transport（または mailbox_command）で Dovecot に渡しているか確かめます。",
    },
  },

  /* 9. relayhost ------------------------------------------------------------ */
  {
    id: "relayhost",
    no: 9,
    chapter: 3,
    icon: "region",
    color: "#4ade80",
    title: "250 なのに届かない",
    sub: "relayhost とキュー — mailq・postqueue -f",
    intro:
      "お店のプロバイダは、迷惑メール対策で **外の25番へのつなぎ方を止めています**（OP25B）。お店のメールサーバーが友だちのお店のサーバーに直接つなごうとしても、つながりません。そんなときは **relayhost** で、プロバイダの中継サーバーに渡します。",
    analogy: "近所の道が通行止めなので、大きな郵便局にまとめて持っていってもらう。",
    knob: {
      ref: "relayhost",
      title: "relayhost = [smtp.isp.example]",
      where: "/etc/postfix/main.cf",
      off: "空（相手の MX に直接）",
      on: "プロバイダの中継サーバーへ",
      isOn: (lab) => {
        const c = running(lab);
        return Boolean(c && pfGet(c, "relayhost"));
      },
    },
    build: (seed) => scenario(seed, { op25b: true, main: { mynetworks: "127.0.0.0/8, 192.168.10.0/24" } }),
    steps: [
      {
        say: "お店のパソコンから、友だちのお店に送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --header 'Subject: 来週の打ち合わせ'`,
        phase: "off",
        ok,
        learn: "**250 Ok: queued as …**。うまくいったように見えます。でも 250 は「あずかった」で、「届いた」ではありません。",
        show: ["trace"],
      },
      {
        say: "メールサーバーの **キュー** を見よう。",
        host: "mail",
        cmd: "mailq",
        phase: "off",
        ok: (r) => ok(r) && has(r, "timed out"),
        learn: "まだキューにいます。**connect to mx.example.com…:25: Connection timed out**。外の25番につながらないので、あとでやりなおすために待っています（4xx のあつかい）。",
        show: ["logs"],
      },
      {
        say: "外へのメールは、プロバイダの中継サーバーに渡すようにしよう。[ ] は「MX をさがさずに、この名前のサーバーへ」という意味です。",
        host: "mail",
        cmd: "postconf -e 'relayhost = [smtp.isp.example]' && postfix reload",
        phase: "apply",
        ok,
        learn: "relayhost を書いて reload しました。",
        show: ["config"],
      },
      {
        say: "もう一度、友だちのお店に送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV} --header 'Subject: 来週の打ち合わせ（再送）'`,
        phase: "on",
        ok,
        learn: "250 で受けとりました。ログを見てみよう。",
      },
      {
        say: "ログの最後を見よう。",
        host: "mail",
        cmd: "tail -n 3 /var/log/maillog",
        phase: "on",
        ok: (r) => ok(r) && has(r, "relay=smtp.isp.example"),
        retry: "まだプロバイダに渡っていません。relayhost を書いて reload したか確かめよう。",
        learn: "**relay=smtp.isp.example … status=sent**。プロバイダの中継サーバーが受けとって、その先へ運んでくれます。",
        show: ["logs", "trace"],
      },
      {
        say: "落とし穴：さっきキューで待っていた1通目は、どうなった？",
        host: "mail",
        cmd: "mailq",
        phase: "trap",
        ok: (r) => ok(r) && has(r, "timed out"),
        learn: "**まだキューにいます**。キューのメールは、決まった時間がたってから、やりなおします（ふつうは数分〜）。設定を直しても、すぐには動きません。",
        show: ["trace"],
      },
      {
        say: "いますぐ、キューのメールを配りなおそう。",
        host: "mail",
        cmd: "postqueue -f && mailq",
        phase: "trap",
        ok: (r) => ok(r) && has(r, "Mail queue is empty"),
        learn: "**postqueue -f**（postfix flush・sendmail -q でも同じ）で、キューのメールをすぐに配りなおしました。こんどは relayhost を通って届き、キューは空です。",
        show: ["logs"],
      },
    ],
    probe: { host: "mail", cmd: "mailq", note: "まっさらなサーバーに、友だちのお店あての1通を送ってから、キューを見ます。", label: (r) => (has(r, "Mail queue is empty") ? "キューは空（届いた）" : "キューに残っている（届いていない）") },
    compare: [
      { head: "外あてのメール", off: "250 だけど、キューに残る（timed out）", on: "プロバイダ経由で届く" },
      { head: "どこにつなぐか", off: "相手の MX（mx.example.com:25）", on: "smtp.isp.example" },
      { head: "残っていたメール", off: "—", on: "postqueue -f で配りなおす" },
    ],
    tries: [
      { label: "外へ送る", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}` },
      { label: "キュー", host: "mail", cmd: "mailq" },
      { label: "配りなおす", host: "mail", cmd: "postqueue -f" },
      { label: "relayhost", host: "mail", cmd: "postconf relayhost" },
      { label: "ない相手へ", host: "pc", cmd: `swaks --to dareka@nai.example --from pochi@wanko.shop ${SV}` },
      { label: "ログ", host: "mail", cmd: "tail -n 6 /var/log/maillog" },
    ],
    summary: ["250 は「あずかった」。届いたかは、ログと mailq で見る", "届けられないメールはキューで待ち、あとでやりなおす（deferred）", "relayhost = [名前] で、外あてを中継サーバーに渡す（[ ] は MX をさがさない）", "mailq で見て、postqueue -f ですぐ配りなおす。postsuper -d で消す"],
    quiz: {
      q: "キューに残ったメールを、いますぐ配りなおすコマンドは？",
      choices: ["postqueue -f", "newaliases", "postconf -n"],
      answer: 0,
      explain: "postqueue -f（postfix flush）でキューをすぐに配りなおします。見るのは mailq（postqueue -p）、消すのは postsuper -d です。",
    },
  },

  /* 10. sendmail の待ち受け -------------------------------------------------- */
  {
    id: "sendmail-daemon",
    no: 10,
    chapter: 4,
    icon: "app",
    color: "#b6f05a",
    title: "sendmail が外から受けとらない",
    sub: "DAEMON_OPTIONS と m4 — sendmail.mc → sendmail.cf",
    intro:
      "こんどのメールサーバーは **sendmail** で動いています。sendmail が読む設定は **sendmail.cf** ですが、とても読みにくいので、人は **sendmail.mc** を書いて、**m4** というコマンドで sendmail.cf を作ります。はじめの sendmail.mc は、**127.0.0.1（自分の中）からしか受けとらない** 設定です。",
    analogy: "設計図（sendmail.mc）を直しても、工場（m4）で部品（sendmail.cf）を作りなおして、とりつけ（再起動）しないと変わらない。",
    knob: {
      ref: "sendmail:daemon",
      title: "DAEMON_OPTIONS から Addr=127.0.0.1 を消す",
      where: "/etc/mail/sendmail.mc → sendmail.cf",
      off: "127.0.0.1:25 だけ",
      on: "0.0.0.0:25（外からも）",
      isOn: (lab) => lab.world.sm?.listen === "0.0.0.0",
    },
    build: (seed) => scenario(seed, { mta: "sendmail", smLocal: true }),
    steps: [
      {
        say: "外から pochi@wanko.shop に送ってみよう。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "off",
        ok: (r) => r.exit === 2,
        learn: "**Connection refused**。25番に、外からつなげません。",
        show: ["trace"],
      },
      {
        say: "メールサーバーで、待ち受けているポートを見よう。",
        host: "mail",
        cmd: "ss -tln",
        phase: "off",
        ok: (r) => ok(r) && has(r, "127.0.0.1:25"),
        learn: "**127.0.0.1:25**。自分の中からしか受けとらない設定です（Postfix の inet_interfaces = loopback-only と同じ考え）。",
      },
      {
        say: "sendmail.mc の DAEMON_OPTIONS から、Addr=127.0.0.1, を消そう。",
        host: "mail",
        cmd: "sed -i 's/Addr=127.0.0.1, //' /etc/mail/sendmail.mc",
        phase: "apply",
        ok,
        learn: "sendmail.mc を書きかえました。",
        show: ["config"],
      },
      {
        say: "sendmail を再起動すれば効くかな？",
        host: "mail",
        cmd: "systemctl restart sendmail && ss -tln",
        phase: "apply",
        prep: false,
        ok: (r) => ok(r) && has(r, "127.0.0.1:25"),
        learn: "まだ 127.0.0.1:25。sendmail が読むのは **sendmail.cf** で、sendmail.mc ではないからです。",
        show: ["config"],
        why: "sendmail:cf",
      },
      {
        say: "**m4** で sendmail.cf を作りなおして、再起動しよう。",
        host: "mail",
        cmd: "m4 /etc/mail/sendmail.mc > /etc/mail/sendmail.cf && systemctl restart sendmail",
        phase: "apply",
        ok,
        learn: "sendmail.cf ができて、sendmail が読みこみました（make -C /etc/mail でも作れます）。",
        show: ["config", "logs"],
      },
      {
        say: "待ち受けているポートを、もう一度。",
        host: "mail",
        cmd: "ss -tln",
        phase: "on",
        ok: (r) => ok(r) && has(r, "0.0.0.0:25"),
        retry: "まだ 127.0.0.1 です。m4 で作りなおして restart したか確かめよう。",
        learn: "**0.0.0.0:25**（どこからでも）。",
      },
      {
        say: "外から pochi@wanko.shop に送ろう。",
        host: "out",
        cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "Message accepted"),
        learn: "**250 … Message accepted for delivery**。sendmail の返事は Postfix と少しちがう形です（Sender ok・Recipient ok など）。",
        show: ["logs", "trace"],
      },
    ],
    probe: { host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}`, label: (r) => (ok(r) ? "外からのメールを受けとった" : "外からつながらない") },
    compare: [
      { head: "待ち受け", off: "127.0.0.1:25", on: "0.0.0.0:25" },
      { head: "外から送る", off: "Connection refused", on: "250 Message accepted" },
      { head: "効かせるには", off: "—", on: "sendmail.mc → m4 → sendmail.cf → restart" },
    ],
    tries: [
      { label: "外から送る", host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV}` },
      { label: "ポート", host: "mail", cmd: "ss -tln" },
      { label: "sendmail.mc", host: "mail", cmd: "cat /etc/mail/sendmail.mc" },
      { label: "sendmail.cf の待ち受け", host: "mail", cmd: "grep DaemonPortOptions /etc/mail/sendmail.cf" },
      { label: "自分の名前", host: "mail", cmd: "cat /etc/mail/local-host-names" },
    ],
    summary: ["sendmail が読むのは sendmail.cf。人が書くのは sendmail.mc", "m4 sendmail.mc > sendmail.cf で作りなおし、再起動して読みこむ", "DAEMON_OPTIONS の Addr=127.0.0.1 は「自分の中からだけ」", "自分あてのドメインは /etc/mail/local-host-names"],
    quiz: {
      q: "sendmail.mc を書きかえたあと、かならずやることは？",
      choices: ["newaliases だけ", "m4 で sendmail.cf を作りなおして、sendmail を再起動", "postfix reload"],
      answer: 1,
      explain: "sendmail が読むのは sendmail.cf。m4 sendmail.mc > sendmail.cf で作りなおして、systemctl restart sendmail します。",
    },
  },

  /* 11. sendmail の access ---------------------------------------------------- */
  {
    id: "sendmail-access",
    no: 11,
    chapter: 4,
    icon: "monitor",
    color: "#e879f9",
    title: "sendmail で中継をゆるす",
    sub: "/etc/mail/access と makemap",
    intro:
      "sendmail では、だれのメールを中継してよいかを **/etc/mail/access** に書きます（Postfix の mynetworks にあたる）。書いたあとは **makemap** で access.db にします。はじめは、サーバーの中（localhost）だけが中継できます。",
    analogy: "窓口に貼る「運んであげる人の名簿」。手書きのメモ（access）を、窓口の人が引ける名簿（access.db）に清書しないと使われない。",
    knob: {
      ref: "sendmail:access",
      title: "Connect:192.168.10 RELAY",
      where: "/etc/mail/access → access.db",
      off: "localhost だけ",
      on: "お店の LAN も中継する",
      isOn: (lab) => /^relay$/i.test(lab.world.accessDb?.get("connect:192.168.10") ?? ""),
    },
    build: (seed) => scenario(seed, { mta: "sendmail" }),
    steps: [
      {
        say: "お店のパソコンから、友だちのお店に送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`,
        phase: "off",
        ok: (r) => r.exit === 24 && has(r, "Relaying denied"),
        learn: "**550 5.7.1 … Relaying denied**。sendmail の中継おことわりの返事です。",
        show: ["trace", "logs"],
      },
      {
        say: "/etc/mail/access に、お店の LAN（192.168.10.）を中継してよい、と足そう。",
        host: "mail",
        cmd: "echo 'Connect:192.168.10 RELAY' >> /etc/mail/access",
        phase: "apply",
        ok,
        learn: "「Connect:192.168.10」は、192.168.10. で始まる IP アドレスのこと。RELAY は「中継してよい」。ほかに OK・REJECT・DISCARD などが書けます。",
        show: ["config"],
      },
      {
        say: "書いただけで送れるかな？",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`,
        phase: "apply",
        prep: false,
        ok: (r) => r.exit === 24,
        learn: "まだ断られます。sendmail が見るのは **access.db** だからです。",
        show: ["config"],
        why: "sendmail:db",
      },
      {
        say: "**makemap** で access.db を作りなおそう（< で access の中身をわたします）。",
        host: "mail",
        cmd: "makemap hash /etc/mail/access < /etc/mail/access",
        phase: "apply",
        ok,
        learn: "access.db を作りました。sendmail は .db を毎回見るので、再起動はいりません。",
        show: ["config"],
      },
      {
        say: "もう一度、お店のパソコンから送ろう。",
        host: "pc",
        cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`,
        phase: "on",
        ok,
        retry: "まだ断られました。makemap をしたか確かめよう。",
        learn: "250 で受けとって、mx.example.com へ運びました。",
        show: ["trace", "logs"],
      },
      {
        say: "外のサーバーからは？",
        host: "out",
        cmd: `swaks --to tomodachi@example.com ${FROM_OUT} ${SV}`,
        phase: "on",
        ok: (r) => r.exit === 24 && has(r, "Relaying denied"),
        learn: "外（203.0.113.80）は access にないので、いままでどおり断ります。ログの **ruleset=check_rcpt … reject=550** が断った記録です。",
        show: ["logs"],
      },
    ],
    probe: { host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}`, label: (r) => (ok(r) ? "お店の LAN からの中継を引きうけた" : "Relaying denied") },
    compare: [
      { head: "お店の LAN → 外", off: "550 Relaying denied", on: "250（中継する）" },
      { head: "外 → 外", off: "550", on: "550（いままでどおり）" },
      { head: "効かせるには", off: "—", on: "access を書く → makemap（再起動はいらない）" },
    ],
    tries: [
      { label: "LAN から外へ", host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}` },
      { label: "外から外へ", host: "out", cmd: `swaks --to tomodachi@example.com ${FROM_OUT} ${SV}` },
      { label: "access を見る", host: "mail", cmd: "cat /etc/mail/access" },
      { label: "キュー", host: "mail", cmd: "mailq" },
      { label: "ログ", host: "mail", cmd: "tail -n 5 /var/log/maillog" },
    ],
    summary: ["sendmail の中継のゆるしは /etc/mail/access（Connect:アドレス RELAY）", "makemap hash /etc/mail/access < /etc/mail/access で .db にする", ".db は毎回読むので再起動はいらない（sendmail.cf を変えたときは再起動）", "aliases も同じく newaliases で .db にする"],
    quiz: {
      q: "/etc/mail/access を書きかえたあと、やることは？",
      choices: ["makemap hash /etc/mail/access < /etc/mail/access", "m4 sendmail.mc > sendmail.cf", "postfix reload"],
      answer: 0,
      explain: "sendmail が見るのは access.db。makemap で作りなおします（make -C /etc/mail でもよい）。",
    },
  },
];

/* ------------------------------------------------------------ 補助 */

export const mailCardById = (id: string) => MAIL_CARDS.find((c) => c.id === id);
export const mailCardLabel = (c: MailCard) => (c.no ? `設定 ${c.no}` : "はじめに");
export { splitStudy };

/** 見くらべるの前に動かしておくこと（届いたメールを数えるカードは、先に1通送っておく） */
const PROBE_SETUP: Record<string, { host: HostId; cmd: string }> = {
  maildir: { host: "out", cmd: `swaks --to hana@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: 新しいシフト'` },
  sieve: { host: "out", cmd: `swaks --to pochi@wanko.shop ${FROM_OUT} ${SV} --header 'Subject: [広告] 秋のセール'` },
  relayhost: { host: "pc", cmd: `swaks --to tomodachi@example.com --from pochi@wanko.shop ${SV}` },
};

/**
 * まっさらなメールサーバーを作る。on なら、設定を入れるステップ（apply）だけを順に動かして「設定あり」にする。
 * forProbe なら、見くらべるの前にやっておくこと（1通送る など）もする
 */
export function prepareMailLab(card: MailCard, on: boolean, seed = MAIL_SEED_BASE + card.no, forProbe = false): { lab: MailLab; runs: MailPrepRun[] } {
  const p = prepareWith(card, on, seed);
  const setup = PROBE_SETUP[card.id];
  if (forProbe && setup) p.runs.push({ host: setup.host, cmd: setup.cmd, run: p.lab.run(setup.host, setup.cmd) });
  return p;
}
