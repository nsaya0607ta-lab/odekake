/**
 * 勉強部屋（LDAP）の台本：「設定カード」。1枚のカードで、1つの設定を学ぶ。
 *
 * どのカードも同じかたち：
 *   1. まず **設定なし** で、本物のコマンドを打ってみる → どう動くか（たいてい、あぶない・こまる・うごかない）を見る
 *   2. **設定を入れる**（本物の ldapmodify・ldapadd・sssd.conf の書きかえ）
 *   3. **設定あり** で、同じことをもう一度 → 何が変わったかを見る
 *   4. くらべる（表）→ わかったこと → クイズ
 *
 * ステップの cmd は、ボタンを押すとターミナルで本当に動く（しくみは ldap.ts / ldap-shell.ts）。
 * fuzz（scripts/fuzz-infra.mjs）で、どのカードも最初から最後まで通して、ok が通る・learn がおかしくないことを確かめる。
 */
import { LdapWorld, parseLdif, type HostId } from "./ldap";
import { LdapLab, type FsNode, type Run, type SssdConf } from "./ldap-shell";
import type { GlyphId } from "./glyphs";

/* ------------------------------------------------------------ 型 */

export type Phase = "off" | "apply" | "on";

export type StudyStep = {
  say: string;
  host: HostId;
  /** ボタンで動かすコマンド（本物の形） */
  cmd: string;
  /** off＝設定なしの実演、apply＝設定を入れる、on＝設定ありの実演 */
  phase: Phase;
  /** 思ったとおりの結果か（ちがえば retry でもう一度） */
  ok?: (r: Run) => boolean;
  retry?: string;
  learn: string | ((r: Run) => string);
  /** 返事といっしょに開くとよいパネル（説明のため、UI がうながす） */
  show?: Panel[];
  /** cmd を動かす前にやること（設定ファイルの書きかえなど、ターミナルの外で起きること） */
  before?: (lab: LdapLab) => void;
  /** before でやったことの見出し（画面に「設定を書きかえました」と出す） */
  beforeNote?: string;
};
export type Panel = "trace" | "packets" | "logs" | "tree" | "config";

export type Knob = {
  /** 設定の目じるし（trace の ref と合わせる） */
  ref: string;
  title: string;
  /** どこの設定か（設定の地図に出す） */
  where: string;
  off: string;
  on: string;
  /** いまの設定が「あり」か（盤面のスイッチに出す） */
  isOn: (lab: LdapLab) => boolean;
};

export type Quiz = { q: string; choices: string[]; answer: number; explain: string };
export type CompareRow = { head: string; off: string; on: string };

export type StudyCard = {
  id: string;
  no: number;
  icon: GlyphId;
  color: string;
  title: string;
  sub: string;
  /** はじめの説明（フレブル先生） */
  intro: string;
  analogy?: string;
  knob: Knob;
  /** シナリオを作る（毎回まっさらから。seed は同じカードなら同じ） */
  build: (seed: number) => LdapLab;
  steps: StudyStep[];
  compare: CompareRow[];
  summary: string[];
  quiz: Quiz;
};

/* ------------------------------------------------------------ 共通のシナリオ（わんこ商店の名簿） */

const SUFFIX = "dc=wanko,dc=shop";
const ADMIN = "cn=admin,dc=wanko,dc=shop";
export const ADMIN_PW = "kanri-pass";

type PersonOpt = { uid: string; cn: string; sn: string; title: string; n: number; pw: string; posix?: boolean; phone?: string };

function personLdif(h: (pw: string) => string, p: PersonOpt): string {
  const lines = [
    `dn: uid=${p.uid},ou=people,${SUFFIX}`,
    "objectClass: inetOrgPerson",
    ...(p.posix === false ? [] : ["objectClass: posixAccount"]),
    `uid: ${p.uid}`,
    `cn: ${p.cn}`,
    `sn: ${p.sn}`,
    `givenName: ${p.cn}`,
    `title: ${p.title}`,
    `mail: ${p.uid}@wanko.shop`,
    `telephoneNumber: ${p.phone ?? `080-0000-${1000 + p.n}`}`,
  ];
  if (p.posix !== false) lines.push(`uidNumber: ${10000 + p.n}`, "gidNumber: 10000", `homeDirectory: /home/${p.uid}`, "loginShell: /bin/bash");
  lines.push(`userPassword: ${h(p.pw)}`);
  return lines.join("\n") + "\n";
}

/** それぞれの正しいパスワード（台本で使う） */
export const PW = { pochi: "Pochi#2026", hana: "Hana@0701", momo: "Momo*0303", kuro: "Kuro&1120" } as const;

const PEOPLE: PersonOpt[] = [
  { uid: "pochi", cn: "ポチ", sn: "柴田", title: "店長", n: 1, pw: PW.pochi },
  { uid: "hana", cn: "ハナ", sn: "秋田", title: "副店長", n: 2, pw: PW.hana },
  { uid: "momo", cn: "モモ", sn: "白井", title: "スタッフ", n: 4, pw: PW.momo },
  { uid: "kuro", cn: "クロ", sn: "黒木", title: "スタッフ", n: 5, pw: PW.kuro },
];

/** シナリオの材料（カードごとに、いるものだけ） */
type Recipe = {
  /** cn=config をいじる（nis を外す・証明書・overlay など） */
  cfg?: (w: LdapWorld) => void;
  /** 人を posixAccount にするか（既定: する） */
  posix?: boolean;
  /** admin グループに入れる人（uid） */
  adminMembers?: string[];
  /** 名簿を水増しする数（インデックスの実演） */
  bulk?: number;
  /** reader（SSSD が名簿を読むアカウント）を置くか */
  reader?: boolean;
  /** お店のサーバーの SSSD の設定 */
  sssd?: Partial<SssdConf>;
  /** お店のサーバーのファイル */
  fs?: Record<string, FsNode>;
  /** ssh で使う、本人の正しいパスワード */
  cast?: Record<string, string>;
  /** それぞれのホストに置くファイル（LDIF など）。h＝ハッシュを作る関数 */
  files?: (h: (pw: string) => string) => Partial<Record<HostId, Record<string, string>>>;
};

function scenario(seed: number, r: Recipe): LdapLab {
  const w = new LdapWorld({ seed });
  w.cfg.rootPW = w.hash(ADMIN_PW);
  r.cfg?.(w);
  const h = (pw: string) => w.hash(pw);
  const recs: string[] = [
    `dn: ${SUFFIX}\nobjectClass: dcObject\nobjectClass: organization\ndc: wanko\no: わんこ商店\n`,
    `dn: ou=people,${SUFFIX}\nobjectClass: organizationalUnit\nou: people\ndescription: スタッフ\n`,
    `dn: ou=groups,${SUFFIX}\nobjectClass: organizationalUnit\nou: groups\ndescription: グループ\n`,
  ];
  for (const p of PEOPLE) recs.push(personLdif(h, { ...p, posix: r.posix }));
  for (let i = 0; i < (r.bulk ?? 0); i++) {
    const n = 100 + i;
    recs.push(personLdif(h, { uid: `member${n}`, cn: `会員${n}`, sn: "会員", title: "会員", n, pw: "x", posix: false }));
  }
  const members = r.adminMembers ?? ["pochi", "hana"];
  recs.push(`dn: cn=admin,ou=groups,${SUFFIX}\nobjectClass: groupOfNames\ncn: admin\ndescription: お店の管理グループ\n${members.map((m) => `member: uid=${m},ou=people,${SUFFIX}`).join("\n")}\n`);
  if (r.reader) {
    recs.push(`dn: ou=apps,${SUFFIX}\nobjectClass: organizationalUnit\nou: apps\n`);
    recs.push(`dn: cn=reader,ou=apps,${SUFFIX}\nobjectClass: organizationalRole\nobjectClass: simpleSecurityObject\ncn: reader\ndescription: SSSD が名簿を読むアカウント\nuserPassword: ${h("Reader-2026")}\n`);
  }
  const parsed = parseLdif(recs.join("\n"), true);
  if (parsed.error) throw new Error(`scenario LDIF: ${parsed.error.line} ${parsed.error.text}`);
  w.load(parsed.records);
  return new LdapLab({ server: w, files: r.files?.(h) ?? {}, sssd: r.sssd, fs: r.fs, cast: r.cast ?? Object.fromEntries(PEOPLE.map((p) => [p.uid, p.pw])) });
}

/* ------------------------------------------------------------ 小物 */

/** 返事の中に、その文字を含む行があるか */
const has = (r: Run, text: string) => r.out.some((l) => !l.err && l.text.includes(text));
/** userPassword の行が返ってきたか */
const hasPw = (r: Run) => r.out.some((l) => /^userPassword:/i.test(l.text.trim()));
const ok = (r: Run) => r.exit === 0;
/** その実行の検索で、何件返ったか */
const searchHits = (r: Run) => r.ops.find((o) => o.kind === "search")?.hits?.length ?? 0;

/* ------------------------------------------------------------ カード */

export const CARDS: StudyCard[] = [
  /* 1. 管理者パスワード -------------------------------------------------- */
  {
    id: "rootpw",
    no: 1,
    icon: "waf",
    color: "#ffc857",
    title: "管理者のパスワード",
    sub: "olcRootPW — 名簿のぜんぶを動かせる人",
    intro:
      "LDAP サーバーには、名簿のぜんぶを読み書きできる **管理者**（olcRootDN。ここでは cn=admin）がいます。でも、パスワード（**olcRootPW**）を決めておかないと、管理者でもログインできません。まずは「設定なし」で入ろうとして、できないのを見てみよう。",
    analogy: "金庫の持ち主でも、暗証番号を決めていなければ開けられないのと同じ。",
    knob: { ref: "rootpw", title: "olcRootPW（管理者のパスワード）", where: "olcDatabase={1}mdb,cn=config", off: "決めていない", on: "{SSHA} のハッシュで決める", isOn: (lab) => lab.server.cfg.rootPW != null },
    build: (seed) =>
      scenario(seed, {
        cfg: (w) => (w.cfg.rootPW = null),
        files: (h) => ({ ldap: { "rootpw.ldif": `dn: olcDatabase={1}mdb,cn=config\nchangetype: modify\nreplace: olcRootPW\nolcRootPW: ${h(ADMIN_PW)}\n` } }),
      }),
    steps: [
      {
        say: "あなたのパソコンから、管理者（cn=admin）でログインできるか試そう。**ldapwhoami** は「わたしはだれ？」とサーバーに聞くコマンドです。",
        host: "pc",
        cmd: `ldapwhoami -x -D "${ADMIN}" -w ${ADMIN_PW}`,
        phase: "off",
        ok: (r) => r.exit === 49,
        retry: "思ったのとちがう結果でした。もう一度ためしてみよう。",
        learn: "**49**（ログインできない）が返りました。cn=admin は管理者なのに、**olcRootPW** を決めていないので、パスワードを確かめられなかったのです。",
        show: ["trace"],
      },
      {
        say: "LDAP サーバーの中で、パスワードのハッシュを作ってみよう。**slappasswd** は、パスワードを {SSHA} というハッシュに変える道具です。",
        host: "ldap",
        cmd: `slappasswd -s ${ADMIN_PW}`,
        phase: "off",
        ok,
        learn: "**{SSHA}…** というハッシュができました。パスワードはそのまま保存せず、こうして「元にもどせない形」にしてから名簿に入れます。",
      },
      {
        say: "では設定を入れよう。**ldapmodify -Y EXTERNAL -H ldapi:///** は、LDAP サーバーの中から root の資格で、設定（cn=config）を書きかえるおまじないです。olcRootPW を決めます。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f rootpw.ldif",
        phase: "apply",
        ok,
        learn: "**olcRootPW** を決めました。cn=config の設定は、サーバーを再起動しなくても、**すぐに効きます**。",
        show: ["config"],
      },
      {
        say: "もう一度、管理者でログインしてみよう。こんどはどうなるかな？",
        host: "pc",
        cmd: `ldapwhoami -x -D "${ADMIN}" -w ${ADMIN_PW}`,
        phase: "on",
        ok: (r) => ok(r) && has(r, `dn:${ADMIN}`),
        retry: "まだ入れませんでした。先に設定を入れたか確かめよう。",
        learn: "入れました！ サーバーが「あなたは **dn:cn=admin,dc=wanko,dc=shop** ですね」と答えています。これで管理者として、名簿を動かせます。",
        show: ["trace"],
      },
    ],
    compare: [
      { head: "管理者でログイン", off: "49（できない）", on: "成功（dn:cn=admin…）" },
      { head: "名簿の読み書き", off: "できない", on: "なんでもできる（olcAccess も飛びこえる）" },
      { head: "パスワードの形", off: "—", on: "{SSHA}（元にもどせないハッシュ）" },
    ],
    summary: ["管理者（olcRootDN）も、olcRootPW を決めないとログインできない", "パスワードは slappasswd で {SSHA} ハッシュにして入れる", "cn=config の設定は、再起動しなくてもすぐ効く"],
    quiz: {
      q: "olcRootPW を決めていないと、管理者（cn=admin）はどうなる？",
      choices: ["パスワードなしで入れる", "ログインできない（49）", "匿名として入れる"],
      answer: 1,
      explain: "パスワードを確かめるもと（olcRootPW）がないので、正しいパスワードを打っても 49（Invalid credentials）になります。",
    },
  },

  /* 2. 匿名アクセス ------------------------------------------------------ */
  {
    id: "anon",
    no: 2,
    icon: "user",
    color: "#9fb4ff",
    title: "匿名で、のぞける？",
    sub: "olcDisallows: bind_anon — 名前を言わないお客さん",
    intro:
      "LDAP は、何も設定しないと **匿名**（名前もパスワードも言わない人）でも名簿を読めます。社員の名前・メール・電話番号が、だれにでも見えてしまう状態です。まず匿名で、どこまで読めるか見てみよう。",
    analogy: "受付に誰もいなくて、社員名簿が玄関に置きっぱなしになっているようなもの。",
    knob: { ref: "anon:disallow", title: "olcDisallows: bind_anon", where: "cn=config", off: "匿名でも入れる", on: "匿名のログインを断る", isOn: (lab) => lab.server.cfg.disallowAnon },
    build: (seed) =>
      scenario(seed, {
        files: () => ({ ldap: { "no-anon.ldif": "dn: cn=config\nchangetype: modify\nadd: olcDisallows\nolcDisallows: bind_anon\n" } }),
      }),
    steps: [
      {
        say: "名前もパスワードも言わずに（匿名で）、スタッフ全員の名前・役職・メールをさがそう。**-x** はシンプル認証、**-b** はさがしはじめる場所です。",
        host: "pc",
        cmd: `ldapsearch -x -LLL -b "${SUFFIX}" "(objectClass=person)" cn title mail`,
        phase: "off",
        ok: (r) => ok(r) && searchHits(r) >= 4 && has(r, "pochi@wanko.shop"),
        retry: "もう一度ためしてみよう。",
        learn: "匿名なのに、スタッフ全員の名前・役職・メールが全部読めてしまいました。名簿がだれにでも見える状態です。",
        show: ["trace"],
      },
      {
        say: "匿名のログインを断る設定（**olcDisallows: bind_anon**）を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f no-anon.ldif",
        phase: "apply",
        ok,
        learn: "**bind_anon** を禁止にしました。これで「名前を言わないログイン」が断られるようになります。",
        show: ["config"],
      },
      {
        say: "もう一度、匿名で同じさがしものをしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL -b "${SUFFIX}" "(objectClass=person)" cn title mail`,
        phase: "on",
        ok: (r) => r.exit === 48,
        retry: "まだ読めてしまいました。設定が入ったか確かめよう。",
        learn: "**48**（匿名は使えない）で断られました。もう、名前を言わないお客さんには何も見せません。ログインした人にだけ見せるようになりました。",
        show: ["trace"],
      },
      {
        say: "では、スタッフの pochi としてログインしてから、さがしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL -D "uid=pochi,ou=people,${SUFFIX}" -w ${PW.pochi} "(uid=hana)" cn mail`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "hana@wanko.shop"),
        retry: "もう一度ためしてみよう。",
        learn: "ちゃんとログインした人には、ちゃんと見えます。「だれでも」から「ログインした人だけ」に変わりました。",
      },
    ],
    compare: [
      { head: "匿名で検索", off: "全員の情報が読める", on: "48（断られる）" },
      { head: "ログインした人", off: "読める", on: "読める" },
      { head: "似た設定", off: "—", on: "olcRequires: authc（検索も含めログイン必須）" },
    ],
    summary: ["LDAP は何もしないと、匿名でも名簿を読める", "olcDisallows: bind_anon で、匿名のログインを断れる", "olcRequires: authc なら、もっと強く「ログイン必須」にできる"],
    quiz: {
      q: "olcDisallows: bind_anon を入れると、どうなる？",
      choices: ["サーバーが止まる", "名前を言わないログイン（匿名）が断られる", "管理者も入れなくなる"],
      answer: 1,
      explain: "匿名バインドだけを断ります。ちゃんと DN とパスワードでログインする人には、今までどおり見えます。",
    },
  },

  /* 3. アクセス制御（ACL） ---------------------------------------------- */
  {
    id: "acl",
    no: 3,
    icon: "lb",
    color: "#ffc857",
    title: "だれに、どこまで",
    sub: "olcAccess — パスワードのハッシュ、見せていい？",
    intro:
      "ログインした人なら、何でも見ていいわけではありません。とくに **userPassword**（パスワードのハッシュ）は、他人に見せてはいけません。**olcAccess** は「だれが・どこまで」を上から順に決める行です。何も設定しないと、OpenLDAP は「だれでも読める」ので、パスワードのハッシュまで読めてしまいます。",
    analogy: "図書館で、ふつうの本はだれでも読めるけれど、個人情報のファイルは本人と司書だけ、と決めるようなもの。",
    knob: { ref: "acl", title: "olcAccess（アクセス制御のルール）", where: "olcDatabase={1}mdb,cn=config", off: "ルールなし（だれでも読める）", on: "userPassword は本人だけ", isOn: (lab) => lab.server.cfg.acl.length > 0 },
    build: (seed) =>
      scenario(seed, {
        files: () => ({
          ldap: {
            "acl.ldif":
              "dn: olcDatabase={1}mdb,cn=config\nchangetype: modify\nreplace: olcAccess\n" +
              "olcAccess: {0}to attrs=userPassword\n  by self write\n  by anonymous auth\n  by * none\n" +
              "olcAccess: {1}to *\n  by * read\n",
          },
        }),
      }),
    steps: [
      {
        say: "匿名で、pochi の **userPassword**（パスワードのハッシュ）をさがしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword`,
        phase: "off",
        ok: (r) => ok(r) && hasPw(r),
        retry: "もう一度ためしてみよう。",
        learn: "パスワードのハッシュ（**userPassword:: {SSHA}…**）が、だれにでも読めてしまいました。これを持ち帰って、時間をかければ、元のパスワードをさがされるかもしれません。",
        show: ["trace"],
      },
      {
        say: "アクセス制御のルール（**olcAccess**）を入れよう。「userPassword は、本人だけ書ける／ログインには使える／ほかの人には見せない」というルールです。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f acl.ldif",
        phase: "apply",
        ok,
        learn: "2行のルールを入れました。**{0}** が userPassword 専用、**{1}** がそれ以外。olcAccess は**上から順に**見て、最初に当たった行で決まります。",
        show: ["config"],
      },
      {
        say: "もう一度、匿名で userPassword をさがそう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword cn`,
        phase: "on",
        ok: (r) => ok(r) && !hasPw(r) && has(r, "uid=pochi"),
        retry: "まだハッシュが見えています。設定が入ったか確かめよう。",
        learn: "エントリは見つかるのに、**userPassword は返ってきません**。「by anonymous auth」はログインに使うだけ（読めない）という意味だからです。",
        show: ["trace"],
      },
      {
        say: "でも本人なら、自分のパスワードは変えられるはず。pochi 本人でログインして、パスワードを変えてみよう（**ldappasswd**）。",
        host: "pc",
        cmd: `ldappasswd -x -D "uid=pochi,ou=people,${SUFFIX}" -w ${PW.pochi} -s NewPochi#99`,
        phase: "on",
        ok,
        retry: "もう一度ためしてみよう。",
        learn: "本人（**by self write**）なので、自分のパスワードは変えられました。「見せない」と「本人は書ける」を、1つのルールで両立しています。",
      },
    ],
    compare: [
      { head: "他人の userPassword を読む", off: "読める（危ない）", on: "返ってこない" },
      { head: "ログイン（パスワード照合）", off: "できる", on: "できる（by anonymous auth）" },
      { head: "本人が自分のを変更", off: "できる", on: "できる（by self write）" },
    ],
    summary: ["olcAccess がないと、OpenLDAP は「だれでも読める」", "olcAccess は上から順に、最初に当たった to の行で決まる", "userPassword は『self write / anonymous auth / * none』が定番"],
    quiz: {
      q: "olcAccess の「by anonymous auth」は、どういう意味？",
      choices: ["匿名でも中身を読める", "ログイン（パスワード照合）には使えるが、値は読めない", "匿名は何もできない"],
      answer: 1,
      explain: "auth は「照合だけ」。だからログインはできるのに、userPassword の中身（ハッシュ）は返ってきません。",
    },
  },

  /* 4. 暗号化（TLS） ---------------------------------------------------- */
  {
    id: "tls",
    no: 4,
    icon: "cdn",
    color: "#34d6b8",
    title: "通り道をのぞかれる",
    sub: "StartTLS / olcSecurity — パスワードは平文で流れる",
    intro:
      "ログインのとき、パスワードはネットワークを通ってサーバーへ行きます。**暗号にしていない（ldap://）**と、その通り道を流れるパスワードは、**そのまま読めてしまいます**。まず暗号なしでログインして、流れたパケットの中を見てみよう。",
    analogy: "ハガキに暗証番号を書いて送るようなもの。配達の途中でだれでも読める。",
    knob: { ref: "tls:security", title: "olcSecurity: tls=1（暗号を必須に）", where: "cn=config", off: "暗号なしでも話せる", on: "暗号なしのつながりを断る", isOn: (lab) => lab.server.cfg.securityTls > 0 },
    build: (seed) =>
      scenario(seed, {
        files: () => ({ ldap: { "require-tls.ldif": "dn: cn=config\nchangetype: modify\nadd: olcSecurity\nolcSecurity: tls=1\n" } }),
      }),
    steps: [
      {
        say: "わざと**暗号にしない**（ldap://）でログインしてみよう。そのあと、流れたパケットの中身を見ます。",
        host: "pc",
        cmd: `ldapwhoami -x -H ldap://ldap.wanko.shop -D "uid=pochi,ou=people,${SUFFIX}" -w ${PW.pochi}`,
        phase: "off",
        ok,
        retry: "もう一度ためしてみよう。",
        learn: "ログインは成功しました。でも「パケット」を見ると、**あなたのパスワードがそのまま流れている**のが分かります（黄色いところ）。",
        show: ["packets"],
      },
      {
        say: "暗号にしていないつながりを断る設定（**olcSecurity: tls=1**）を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f require-tls.ldif",
        phase: "apply",
        ok,
        learn: "「暗号にしていないつながりは断る」という設定を入れました。",
        show: ["config"],
      },
      {
        say: "もう一度、暗号なし（ldap://）でログインしてみよう。",
        host: "pc",
        cmd: `ldapwhoami -x -H ldap://ldap.wanko.shop -D "uid=pochi,ou=people,${SUFFIX}" -w ${PW.pochi}`,
        phase: "on",
        ok: (r) => r.exit === 13,
        retry: "もう一度ためしてみよう。",
        learn: "**13**（暗号にしないと話せない）で断られました。これで「平文のまま流す」ことはできません。",
        show: ["trace"],
      },
      {
        say: "では暗号にして（**-ZZ** = StartTLS）ログインしよう。こんどはパケットを見ても、中身は読めないはず。",
        host: "pc",
        cmd: `ldapwhoami -x -ZZ -H ldap://ldap.wanko.shop -D "uid=pochi,ou=people,${SUFFIX}" -w ${PW.pochi}`,
        phase: "on",
        ok,
        retry: "もう一度ためしてみよう。",
        learn: "StartTLS で暗号にしてからログインしました。パケットは「**Application Data**（読めないバイト）」になり、パスワードは見えません。はじめから **ldaps://** でつなぐのも同じです。",
        show: ["packets"],
      },
    ],
    compare: [
      { head: "ldap://（暗号なし）でログイン", off: "成功（でも平文）", on: "13（断られる）" },
      { head: "パケットの中のパスワード", off: "そのまま読める", on: "読めない（暗号）" },
      { head: "-ZZ（StartTLS）/ ldaps://", off: "—", on: "暗号で安全にログイン" },
    ],
    summary: ["暗号にしないと、パスワードは通り道でそのまま読める", "StartTLS（-ZZ）や ldaps:// で、通り道を暗号にする", "olcSecurity: tls=1 で、暗号なしのつながりを断れる"],
    quiz: {
      q: "ldap://（暗号なし）でログインしたときの、いちばんの問題は？",
      choices: ["速度が遅い", "パスワードが通り道でそのまま読める", "サーバーが落ちる"],
      answer: 1,
      explain: "中身が平文なので、通り道を見られるとパスワードが盗まれます。StartTLS か ldaps:// で暗号にします。",
    },
  },

  /* 5. スキーマ --------------------------------------------------------- */
  {
    id: "schema",
    no: 5,
    icon: "db",
    color: "#b08cff",
    title: "知らない言葉は書けない",
    sub: "スキーマ — posixAccount・uidNumber を使うには",
    intro:
      "名簿に書ける「属性」や「種類（objectClass）」は、**スキーマ**で決まっています。Linux のログインに使う **posixAccount**（uidNumber・homeDirectory など）は、**nis** というスキーマに入っています。読みこんでいないと、サーバーは「そんな言葉は知らない」と断ります。",
    analogy: "辞書に載っていない言葉は、書類に書けないのと同じ。使う前に、その辞書を本棚に入れておく。",
    knob: { ref: "schema:nis", title: "nis スキーマ", where: "cn=schema,cn=config", off: "読みこんでいない", on: "読みこみずみ", isOn: (lab) => lab.server.cfg.schemas.has("nis") },
    build: (seed) =>
      scenario(seed, {
        posix: false,
        cfg: (w) => w.cfg.schemas.delete("nis"),
        files: () => ({
          ldap: { "nis.ldif": "dn: cn=nis,cn=schema,cn=config\nchangetype: add\nobjectClass: olcSchemaConfig\ncn: nis\n" },
          pc: {
            "momo-posix.ldif":
              `dn: uid=momo,ou=people,${SUFFIX}\nchangetype: modify\nadd: objectClass\nobjectClass: posixAccount\n-\nadd: uidNumber\nuidNumber: 10004\n-\nadd: gidNumber\ngidNumber: 10000\n-\nadd: homeDirectory\nhomeDirectory: /home/momo\n`,
          },
        }),
      }),
    steps: [
      {
        say: "モモに、Linux のログイン情報（**posixAccount**）を足してみよう。まだ nis スキーマは読みこんでいません。",
        host: "pc",
        cmd: `ldapmodify -x -D "${ADMIN}" -w ${ADMIN_PW} -f momo-posix.ldif`,
        phase: "off",
        ok: (r) => r.exit === 21 || r.exit === 17,
        retry: "もう一度ためしてみよう。",
        learn: "**21**（知らない値）で断られました。**posixAccount** という種類も **uidNumber** という属性も、nis スキーマを読みこんでいないので、サーバーは知らないのです。",
        show: ["trace"],
      },
      {
        say: "nis スキーマを読みこもう。本物の OpenLDAP では用意ずみのスキーマを足すだけです。",
        host: "ldap",
        cmd: "ldapadd -Y EXTERNAL -H ldapi:/// -f nis.ldif",
        phase: "apply",
        ok,
        learn: "**nis** スキーマを読みこみました。これで posixAccount・uidNumber・homeDirectory などが使えます。",
        show: ["config"],
      },
      {
        say: "もう一度、モモに posixAccount を足してみよう。",
        host: "pc",
        cmd: `ldapmodify -x -D "${ADMIN}" -w ${ADMIN_PW} -f momo-posix.ldif`,
        phase: "on",
        ok,
        retry: "もう一度ためしてみよう。",
        learn: "こんどは成功！ スキーマを読みこんだので、サーバーが posixAccount を理解できるようになりました。",
      },
      {
        say: "モモに uidNumber が入ったか、確かめよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=momo)" objectClass uidNumber homeDirectory`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "uidNumber: 10004"),
        retry: "もう一度ためしてみよう。",
        learn: "posixAccount・uidNumber・homeDirectory が入りました。これで、このあとのカードで「LDAP でサーバーにログイン」ができます。",
      },
    ],
    compare: [
      { head: "posixAccount を足す", off: "21（知らない）", on: "成功" },
      { head: "uidNumber・homeDirectory", off: "使えない", on: "使える" },
      { head: "できること", off: "名前・メールだけ", on: "Linux のログインにも使える" },
    ],
    summary: ["書ける属性・種類はスキーマで決まる", "Linux ログイン用の posixAccount は nis スキーマ", "スキーマは使う前に読みこんでおく（一度読むと消せない）"],
    quiz: {
      q: "nis スキーマを読みこんでいないと、posixAccount を足そうとするとどうなる？",
      choices: ["成功する", "21（知らない値）で断られる", "匿名になる"],
      answer: 1,
      explain: "サーバーが posixAccount や uidNumber を知らないので、追加できません。先にスキーマを読みこみます。",
    },
  },

  /* 6. インデックス ----------------------------------------------------- */
  {
    id: "index",
    no: 6,
    icon: "cache",
    color: "#b6f05a",
    title: "さがすのが遅い",
    sub: "olcDbIndex — 全部見るか、索引で一発か",
    intro:
      "名簿が大きくなると、さがしものに時間がかかります。**インデックス**（olcDbIndex）がない属性でさがすと、サーバーは名簿を**1件ずつ全部**見ます。会員が何千人もいると、これは遅い。索引を作ると、一発で見つかります。",
    analogy: "辞書のつめ（インデックス）がないと、最初のページから1枚ずつめくって言葉をさがすようなもの。",
    knob: { ref: "index:mail", title: "olcDbIndex: mail eq", where: "olcDatabase={1}mdb,cn=config", off: "mail の索引なし", on: "mail の索引あり", isOn: (lab) => Boolean(lab.server.cfg.index.get("mail")?.has("eq")) },
    build: (seed) =>
      scenario(seed, {
        bulk: 2000,
        files: () => ({ ldap: { "index.ldif": "dn: olcDatabase={1}mdb,cn=config\nchangetype: modify\nadd: olcDbIndex\nolcDbIndex: mail eq\n" } }),
      }),
    steps: [
      {
        say: "会員が 2000人を超える名簿です。メールアドレスで1人さがしてみよう。「サーバーの中」を見ると、何件見たか分かります。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn`,
        phase: "off",
        ok: (r) => ok(r) && (r.ops.find((o) => o.kind === "search")?.scanned ?? 0) > 1000,
        retry: "もう一度ためしてみよう。",
        learn: (r) => {
          const op = r.ops.find((o) => o.kind === "search");
          return `見つかりましたが、サーバーは名簿を **${(op?.scanned ?? 0).toLocaleString("en-US")}件、1件ずつ** 見ました（mail に索引がないから）。ログに「not indexed」と出ています。`;
        },
        show: ["trace", "logs"],
      },
      {
        say: "メールアドレスの索引（**olcDbIndex: mail eq**）を作ろう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f index.ldif",
        phase: "apply",
        ok,
        learn: "**mail eq**（＝一致でさがすための索引）を作りました。cn=config で足すと、索引は自動で作りなおされます。",
        show: ["config"],
      },
      {
        say: "もう一度、同じメールアドレスでさがそう。何件見るかな？",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn`,
        phase: "on",
        ok: (r) => ok(r) && (r.ops.find((o) => o.kind === "search")?.indexed ?? false),
        retry: "もう一度ためしてみよう。",
        learn: (r) => {
          const op = r.ops.find((o) => o.kind === "search");
          return `こんどは索引で、候補を **${(op?.scanned ?? 0).toLocaleString("en-US")}件** にしぼれました。2000件を全部見なくてよくなったので、ずっと速いです。`;
        },
        show: ["trace"],
      },
    ],
    compare: [
      { head: "mail でさがす", off: "2000件を全部見る", on: "索引で候補だけ" },
      { head: "速さ", off: "遅い", on: "速い" },
      { head: "よく索引にする属性", off: "—", on: "uid・mail・objectClass・member など" },
    ],
    summary: ["索引のない属性でさがすと、名簿を全部1件ずつ見る", "olcDbIndex eq で、＝一致の索引を作れる", "よくさがす属性（uid・mail など）に索引をつける"],
    quiz: {
      q: "olcDbIndex のない属性で検索すると？",
      choices: ["エラーになる", "名簿を1件ずつ全部見る（遅い）", "何も返らない"],
      answer: 1,
      explain: "索引がないと全件走査（not indexed）になります。大きな名簿では遅くなるので、よく使う属性に索引をつけます。",
    },
  },

  /* 7. パスワードポリシー ------------------------------------------------ */
  {
    id: "ppolicy",
    no: 7,
    icon: "monitor",
    color: "#60a5fa",
    title: "何回でも、ためし放題？",
    sub: "ppolicy — まちがえ続けたらロック",
    intro:
      "パスワードを**何回でも**ためせると、attack する人が「総当たり」で当ててしまうかもしれません。**ppolicy** overlay を入れると、「○回まちがえたら、しばらくロック」ができます。まず、設定なしで何回でもためせることを見てみよう。",
    analogy: "暗証番号を何回まちがえてもいい ATM は危ない。ふつうは数回で止まる。",
    knob: { ref: "ppolicy", title: "ppolicy overlay＋olcPPolicyDefault", where: "olcDatabase={1}mdb,cn=config", off: "ロックなし（ため放題）", on: "3回でロック", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "ppolicy") },
    build: (seed) =>
      scenario(seed, {
        files: () => ({
          ldap: {
            "ppolicy.ldif":
              "dn: cn=module{0},cn=config\nchangetype: modify\nadd: olcModuleLoad\nolcModuleLoad: ppolicy\n\n" +
              "dn: olcOverlay=ppolicy,olcDatabase={1}mdb,cn=config\nchangetype: add\nobjectClass: olcOverlayConfig\nobjectClass: olcPPolicyConfig\nolcOverlay: ppolicy\nolcPPolicyDefault: cn=default,ou=policies,dc=wanko,dc=shop\n",
          },
          pc: {
            "policy.ldif":
              `dn: ou=policies,${SUFFIX}\nchangetype: add\nobjectClass: organizationalUnit\nou: policies\n\n` +
              `dn: cn=default,ou=policies,${SUFFIX}\nchangetype: add\nobjectClass: pwdPolicy\nobjectClass: device\ncn: default\npwdAttribute: userPassword\npwdMaxFailure: 3\npwdLockout: TRUE\npwdLockoutDuration: 300\npwdFailureCountInterval: 600\n`,
          },
        }),
      }),
    steps: [
      {
        say: "ハナのパスワードを、わざと**まちがえて**何度もログインしてみよう（3回つづけて）。設定なしだと、どうなるかな？",
        host: "pc",
        cmd: `ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai ; ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai ; ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai`,
        phase: "off",
        ok: (r) => r.ops.filter((o) => o.kind === "bind" && o.code === 49).length >= 3,
        retry: "もう一度ためしてみよう。",
        learn: "3回とも 49（ちがう）ですが、サーバーは**数えていません**。この調子で何千回でもためせるので、総当たりで当てられる危険があります。",
        show: ["trace"],
      },
      {
        say: "パスワードのルールを使う **ppolicy** overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f ppolicy.ldif",
        phase: "apply",
        ok,
        learn: "ppolicy overlay を入れました。あとは「どんなルールか」を書いたエントリを足します。",
        show: ["config"],
      },
      {
        say: "ルールのエントリ（3回まちがえたら 300秒ロック）を足そう。これは本体の名簿に置くので、管理者（cn=admin）で足します。",
        host: "pc",
        cmd: `ldapadd -x -D "${ADMIN}" -w ${ADMIN_PW} -f policy.ldif`,
        phase: "apply",
        ok,
        learn: "**pwdMaxFailure: 3**（3回まで）・**pwdLockout: TRUE**（ロックする）・**pwdLockoutDuration: 300**（300秒）というルールを置きました。",
      },
      {
        say: "では、またハナのパスワードを3回まちがえてみよう。",
        host: "pc",
        cmd: `ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai ; ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai ; ldapwhoami -x -D "uid=hana,ou=people,${SUFFIX}" -w machigai`,
        phase: "on",
        ok: (r) => r.ops.some((o) => o.kind === "bind" && o.lockedNow),
        retry: "もう一度ためしてみよう。",
        learn: "3回目で、サーバーが「もうロック」と決めました。ppolicy が、まちがいの回数を数えていたのです。",
        show: ["trace"],
      },
      {
        say: "ロックされたので、こんどは**正しい**パスワードを打っても…？",
        host: "pc",
        cmd: `ldapwhoami -x -e ppolicy -D "uid=hana,ou=people,${SUFFIX}" -w ${PW.hana}`,
        phase: "on",
        ok: (r) => r.exit === 49,
        retry: "もう一度ためしてみよう。",
        learn: "正しいパスワードなのに 49（入れない）。**Account locked**（ロック中）だからです。300秒たつか、管理者がロックを外すまで待ちます。これで総当たりはできません。",
        show: ["trace", "tree"],
      },
    ],
    compare: [
      { head: "パスワードを3回まちがえる", off: "ずっと 49、数えない", on: "3回でロック" },
      { head: "ロック後、正しいパスワード", off: "入れる", on: "49（Account locked）" },
      { head: "総当たり attack", off: "できてしまう", on: "止められる" },
    ],
    summary: ["設定なしだと、パスワードは何回でもためせる", "ppolicy overlay＋pwdMaxFailure・pwdLockout でロックできる", "ロック中は、正しいパスワードでも入れない（時間かで解除）"],
    quiz: {
      q: "pwdMaxFailure: 3・pwdLockout: TRUE のとき、3回続けてまちがえると？",
      choices: ["何も起きない", "アカウントがロックされ、正しいパスワードでも入れなくなる", "パスワードが消える"],
      answer: 1,
      explain: "回数をこえるとロックされ、pwdLockoutDuration の時間がすぎるまで（または管理者が外すまで）入れません。",
    },
  },

  /* 8. memberOf --------------------------------------------------------- */
  {
    id: "memberof",
    no: 8,
    icon: "worker",
    color: "#ffa45c",
    title: "どのグループの人？",
    sub: "memberof overlay — 人から、グループを辿る",
    intro:
      "グループ（groupOfNames）は「だれが入っているか（**member**）」を持っています。でも、人のほうから「わたしはどのグループ？」はすぐには分かりません。**memberof** overlay を入れると、人のエントリに **memberOf** が自動で書かれ、人からグループを辿れます。",
    analogy: "名簿には「野球部の部員一覧」はあるけれど、生徒カードに「所属：野球部」を書いておくと、生徒から一発で分かる。",
    knob: { ref: "memberof", title: "memberof overlay", where: "olcDatabase={1}mdb,cn=config", off: "memberOf なし", on: "グループ変更時に memberOf を書く", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "memberof") },
    build: (seed) =>
      scenario(seed, {
        adminMembers: ["pochi", "hana"],
        files: () => ({
          ldap: {
            "memberof.ldif":
              "dn: cn=module{0},cn=config\nchangetype: modify\nadd: olcModuleLoad\nolcModuleLoad: memberof\n\n" +
              "dn: olcOverlay=memberof,olcDatabase={1}mdb,cn=config\nchangetype: add\nobjectClass: olcOverlayConfig\nobjectClass: olcMemberOf\nolcOverlay: memberof\n",
          },
          pc: { "join.ldif": `dn: cn=admin,ou=groups,${SUFFIX}\nchangetype: modify\nadd: member\nmember: uid=momo,ou=people,${SUFFIX}\n` },
        }),
      }),
    steps: [
      {
        say: "pochi は、どのグループに入っている？ 人のエントリから **memberOf** をさがしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" memberOf`,
        phase: "off",
        ok: (r) => ok(r) && !has(r, "memberOf:"),
        retry: "もう一度ためしてみよう。",
        learn: "pochi のエントリに **memberOf はありません**。いまは「グループ側の member」にしか情報がないので、人からは辿れないのです。",
        show: ["trace"],
      },
      {
        say: "memberof overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f memberof.ldif",
        phase: "apply",
        ok,
        learn: "memberof overlay を入れました。でも注意：overlay は、**これから**グループが変わったときに memberOf を書きます。昔から入っている人には、まだ書かれていません。",
        show: ["config"],
      },
      {
        say: "ためしに、モモを admin グループに**入れて**みよう。overlay が働くかな？",
        host: "pc",
        cmd: `ldapmodify -x -D "${ADMIN}" -w ${ADMIN_PW} -f join.ldif`,
        phase: "on",
        ok,
        learn: "モモを admin グループに足しました。グループが変わったので、memberof overlay が働いたはずです。",
      },
      {
        say: "モモの memberOf を見てみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=momo)" memberOf`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "memberOf:") && has(r, "cn=admin"),
        retry: "もう一度ためしてみよう。",
        learn: "モモのエントリに **memberOf: cn=admin,ou=groups,…** が自動で書かれました！ これで「人 → グループ」が一発で辿れます。",
        show: ["tree"],
      },
    ],
    compare: [
      { head: "人から memberOf を見る", off: "ない", on: "ある（自動で書かれる）" },
      { head: "グループ側の member", off: "ある", on: "ある（変わらず）" },
      { head: "注意", off: "—", on: "overlay を入れる前からの人には、入れただけでは付かない" },
    ],
    summary: ["ふつうは『グループ → member』しかない", "memberof overlay で、人に memberOf が自動で付く", "overlay は変更があったときに書く（既存の人は入れ直しが要る）"],
    quiz: {
      q: "memberof overlay を入れると、何が起きる？",
      choices: ["グループが消える", "人のエントリに memberOf が自動で書かれる", "パスワードが隠れる"],
      answer: 1,
      explain: "member を持つグループが変わると、その人の memberOf を自動で書きます。人からグループを辿れるようになります。",
    },
  },

  /* 9. refint ----------------------------------------------------------- */
  {
    id: "refint",
    no: 9,
    icon: "replica",
    color: "#d3c2ff",
    title: "消したのに、残ってる",
    sub: "refint overlay — いない人への参照を片づける",
    intro:
      "グループの **member** は、人の DN を指しています。人を削除しても、グループの member には**その人の DN が残ったまま**です（いない人を指す「迷子の参照」）。**refint**（参照整合性）overlay を入れると、人を消したときに、グループの member からも自動で消します。",
    analogy: "退部した部員を名簿から消しても、部員一覧に名前が残っていると混乱する。一緒に消すのが refint。",
    knob: { ref: "refint", title: "refint overlay（olcRefintAttribute: member）", where: "olcDatabase={1}mdb,cn=config", off: "参照は残る", on: "消した人を member からも消す", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "refint") },
    build: (seed) =>
      scenario(seed, {
        adminMembers: ["pochi", "hana", "momo"],
        files: () => ({
          ldap: {
            "refint.ldif":
              "dn: cn=module{0},cn=config\nchangetype: modify\nadd: olcModuleLoad\nolcModuleLoad: refint\n\n" +
              `dn: olcOverlay=refint,olcDatabase={1}mdb,cn=config\nchangetype: add\nobjectClass: olcOverlayConfig\nobjectClass: olcRefintConfig\nolcOverlay: refint\nolcRefintAttribute: member\nolcRefintNothing: ${ADMIN}\n`,
          },
        }),
      }),
    steps: [
      {
        say: "admin グループには pochi・hana・momo が入っています。まず **hana を削除**してみよう。",
        host: "pc",
        cmd: `ldapdelete -x -D "${ADMIN}" -w ${ADMIN_PW} "uid=hana,ou=people,${SUFFIX}"`,
        phase: "off",
        ok,
        learn: "ハナを名簿から消しました。では、admin グループの member はどうなっているでしょう？",
      },
      {
        say: "admin グループの member を見てみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(cn=admin)" member`,
        phase: "off",
        ok: (r) => ok(r) && has(r, "uid=hana"),
        retry: "もう一度ためしてみよう。",
        learn: "消したはずの **uid=hana** が、member に**残ったまま**です。もういない人を指す「迷子の参照」になっています。",
        show: ["trace"],
      },
      {
        say: "参照を自動で片づける **refint** overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f refint.ldif",
        phase: "apply",
        ok,
        learn: "refint overlay を入れました（**olcRefintAttribute: member**）。これから member が指す人を消すと、member からも消えます。",
        show: ["config"],
      },
      {
        say: "では、こんどは **momo を削除**してみよう。member はどうなるかな？",
        host: "pc",
        cmd: `ldapdelete -x -D "${ADMIN}" -w ${ADMIN_PW} "uid=momo,ou=people,${SUFFIX}"`,
        phase: "on",
        ok: (r) => ok(r) && (r.ops.find((o) => o.kind === "delete")?.touched?.length ?? 0) > 0,
        retry: "もう一度ためしてみよう。",
        learn: "モモを消したら、refint が **admin の member からもモモを消して**くれました（「サーバーの中」に出ています）。",
        show: ["trace"],
      },
      {
        say: "admin グループの member を、もう一度見てみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(cn=admin)" member`,
        phase: "on",
        ok: (r) => ok(r) && !has(r, "uid=momo") && has(r, "uid=pochi"),
        retry: "もう一度ためしてみよう。",
        learn: "モモは member から消え、迷子の参照はできませんでした。一方、設定前に消した hana は残ったまま。refint は「これから」の削除を片づけます。",
      },
    ],
    compare: [
      { head: "人を削除したあとの member", off: "消した人が残る（迷子）", on: "自動で消える" },
      { head: "名簿の整合性", off: "くずれる", on: "保たれる" },
      { head: "いつ効く", off: "—", on: "overlay を入れたあとの削除" },
    ],
    summary: ["人を消しても、グループの member には DN が残る", "refint overlay が、消した人への参照を自動で片づける", "効くのは overlay を入れたあとの削除（前のぶんは残る）"],
    quiz: {
      q: "refint overlay がないと、グループのメンバーを削除したとき何が起きる？",
      choices: ["グループも消える", "member に、いない人の DN が残る", "エラーになる"],
      answer: 1,
      explain: "参照が自動で片づかないので、存在しない人を指す member が残ります。refint がそれを消してくれます。",
    },
  },

  /* 10. unique（番号の重複） -------------------------------------------- */
  {
    id: "unique",
    no: 10,
    icon: "auto",
    color: "#4ade80",
    title: "番号がかぶると、別人になれる",
    sub: "unique overlay — uidNumber のかぶりを止める",
    intro:
      "Linux は、人を**番号（uidNumber）**で見分けます。名前ではありません。もし2人が同じ uidNumber を持つと、Linux からは**同じ人**に見えてしまい、他人のファイルが読めてしまいます。**unique** overlay で、番号のかぶりを止めましょう。",
    analogy: "社員証の番号が同じ人が2人いると、入退室の記録でも給料でも、2人が区別できなくなる。",
    knob: { ref: "unique", title: "unique overlay（uidNumber）", where: "olcDatabase={1}mdb,cn=config", off: "かぶってもOK", on: "同じ uidNumber を断る", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "unique") },
    build: (seed) =>
      scenario(seed, {
        reader: true,
        sssd: { access: "permit" },
        fs: {
          "/home": { uid: 0, gid: 0, mode: 0o755, dir: true },
          "/home/pochi": { uid: 10001, gid: 10000, mode: 0o700, dir: true },
          "/home/pochi/uriage.txt": { uid: 10001, gid: 10000, mode: 0o600, content: "10月の売上：1,250,000円（店長 pochi だけが見られる）", size: 60, mtime: "Oct 12 20:10" },
        },
        cast: { pochi: "Pochi#2026", hana: "Hana@0701", momo: "Momo*0303", kuro: "Kuro&1120", shiro: "Shiro$2026", tora: "Tora%2026" },
        files: (h) => ({
          ldap: {
            "unique.ldif":
              "dn: cn=module{0},cn=config\nchangetype: modify\nadd: olcModuleLoad\nolcModuleLoad: unique\n\n" +
              `dn: olcOverlay=unique,olcDatabase={1}mdb,cn=config\nchangetype: add\nobjectClass: olcOverlayConfig\nobjectClass: olcUniqueConfig\nolcOverlay: unique\nolcUniqueURI: ldap:///${SUFFIX}?uidNumber?sub\n`,
          },
          pc: {
            "shiro.ldif": newUser(h, "shiro", "シロ", "新人", 10001, "Shiro$2026"),
            "tora.ldif": newUser(h, "tora", "トラ", "新人", 10001, "Tora%2026"),
          },
        }),
      }),
    steps: [
      {
        say: "新人シロを名簿に足します。でも、うっかり **uidNumber を 10001**（店長 pochi と同じ）にしてしまいました。設定なしだと、追加できてしまうかな？",
        host: "pc",
        cmd: `ldapadd -x -D "${ADMIN}" -w ${ADMIN_PW} -f shiro.ldif`,
        phase: "off",
        ok,
        retry: "もう一度ためしてみよう。",
        learn: "追加**できてしまいました**。LDAP は、何もしないと番号のかぶりを気にしません。これから何が起きるか見てみよう。",
      },
      {
        say: "シロで、お店のサーバー（shop）にログインして「自分はだれ？」と聞いてみよう。",
        host: "pc",
        cmd: "ssh shiro@shop whoami",
        phase: "off",
        ok: (r) => ok(r) && has(r, "pochi"),
        retry: "もう一度ためしてみよう。",
        learn: "シロでログインしたのに、**pochi** と出ました！ Linux は uidNumber 10001 で人を見分けるので、同じ番号の最初の人（pochi）と区別できないのです。",
        show: ["trace"],
      },
      {
        say: "もっと怖いことに…。シロで、店長しか見られないはずの売上ファイルを読んでみよう。",
        host: "pc",
        cmd: "ssh shiro@shop cat /home/pochi/uriage.txt",
        phase: "off",
        ok: (r) => ok(r) && has(r, "売上"),
        retry: "もう一度ためしてみよう。",
        learn: "読めてしまいました。ファイルの持ち主は uid 10001。シロも 10001 なので、Linux からは「自分のファイル」に見えるのです。番号のかぶりは、こんなに危ない。",
        show: ["trace"],
      },
      {
        say: "番号のかぶりを止める **unique** overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f unique.ldif",
        phase: "apply",
        ok,
        learn: "uidNumber がかぶらないよう見張る overlay を入れました（**olcUniqueURI … ?uidNumber?sub**）。",
        show: ["config"],
      },
      {
        say: "もう1人、別の新人トラも uidNumber 10001 で足そうとしてみよう。こんどはどうなる？",
        host: "pc",
        cmd: `ldapadd -x -D "${ADMIN}" -w ${ADMIN_PW} -f tora.ldif`,
        phase: "on",
        ok: (r) => r.exit === 19,
        retry: "もう一度ためしてみよう。",
        learn: "**19**（決まりに合わない）で断られました！ 「uidNumber 10001 は、もう pochi が使っている」と unique が止めてくれたのです。番号はひとり1つ。",
        show: ["trace"],
      },
    ],
    compare: [
      { head: "同じ uidNumber で追加", off: "できてしまう", on: "19（断られる）" },
      { head: "別人なのに他人のファイル", off: "読めてしまう", on: "番号が重複しないので安全" },
      { head: "Linux の人の見分け方", off: "番号（かぶると区別不能）", on: "番号（かぶらない）" },
    ],
    summary: ["Linux は人を uidNumber（番号）で見分ける", "番号がかぶると、別人なのに同じ権限になってしまう", "unique overlay で、番号のかぶりを入口で止める"],
    quiz: {
      q: "2人が同じ uidNumber を持つと、Linux ではどうなる？",
      choices: ["どちらも入れない", "別人なのに同じ人として扱われ、他人のファイルも読める", "番号が自動で変わる"],
      answer: 1,
      explain: "Linux は番号で人を見分けるので、同じ番号の2人は区別できません。unique overlay で重複を防ぎます。",
    },
  },

  /* 11. SSSD のアクセス制御 --------------------------------------------- */
  {
    id: "sssd",
    no: 11,
    icon: "region",
    color: "#e879f9",
    title: "名簿にいれば、入れちゃう？",
    sub: "SSSD の ldap_access_filter — ログインできる人をしぼる",
    intro:
      "お店のサーバー（shop）は、**SSSD** という仕組みで LDAP の名簿を見て、ログインさせます。何も設定しないと、**名簿にいる人は全員**ログインできます。アルバイトも、サーバーにログインできてしまう。**ldap_access_filter** で、入れる人をしぼりましょう。設定ファイル sssd.conf は、画面の「設定」で書きかえ、**systemctl restart sssd** で読みこみます。",
    analogy: "社員証を持っていれば、全員がサーバー室に入れてしまう状態。本当は、担当者だけが入れるべき。",
    knob: { ref: "sssd:access", title: "ldap_access_filter（お店のサーバーの sssd.conf）", where: "/etc/sssd/sssd.conf（shop）", off: "permit（名簿の全員）", on: "店長だけ", isOn: (lab) => lab.sssd.running.access === "ldap" && Boolean(lab.sssd.running.filter) },
    build: (seed) => scenario(seed, { reader: true, sssd: { access: "permit" }, cast: { pochi: "Pochi#2026", hana: "Hana@0701", momo: "Momo*0303" } }),
    steps: [
      {
        say: "まず、アルバイトのモモで、お店のサーバーにログインできるか試そう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        phase: "off",
        ok: (r) => ok(r) && has(r, "momo"),
        retry: "もう一度ためしてみよう。",
        learn: "モモでログインできてしまいました。SSSD は access_provider を設定していないと **permit**（名簿にいれば全員 OK）だからです。",
        show: ["trace"],
      },
      {
        say: "お店のサーバーの **sssd.conf** を書きかえて、「**店長（title=店長）だけ**入れる」ルールにしました（画面の「設定」で変えられます）。まず、書きかえただけで効くか、もう一度モモで試そう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        phase: "apply",
        before: (lab) => {
          lab.sssd.file.access = "ldap";
          lab.sssd.file.filter = "(title=店長)";
        },
        beforeNote: "sssd.conf を書きかえた：access_provider = ldap ／ ldap_access_filter = (title=店長)",
        ok: (r) => ok(r) && has(r, "momo"),
        retry: "もう一度ためしてみよう。",
        learn: "まだモモが入れます。sssd.conf を書きかえても、**動いている SSSD は読みこむまで古いまま**だからです。再起動が要ります。",
        show: ["trace", "config"],
      },
      {
        say: "お店のサーバーで、SSSD を再起動して、新しい設定を読みこもう。",
        host: "shop",
        cmd: "systemctl restart sssd",
        phase: "apply",
        ok,
        learn: "SSSD を再起動しました。これで新しい sssd.conf（店長だけ）が効きます。",
        show: ["logs"],
      },
      {
        say: "もう一度、アルバイトのモモでログインを試そう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        phase: "on",
        ok: (r) => r.exit !== 0 && (r.ops.find((o) => o.kind === "ssh")?.stage === "access"),
        retry: "もう一度ためしてみよう。",
        learn: "こんどは**入れません**（Permission denied）。パスワードは合っているのに、**ldap_access_filter（title=店長）に当てはまらない**ので、SSSD が入口で断りました。",
        show: ["trace", "logs"],
      },
      {
        say: "では、店長の pochi なら入れるはず。試そう。",
        host: "pc",
        cmd: "ssh pochi@shop whoami",
        phase: "on",
        ok: (r) => ok(r) && has(r, "pochi"),
        retry: "もう一度ためしてみよう。",
        learn: "店長の pochi は入れました。「名簿にいる全員」から「店長だけ」に、ログインできる人をしぼれました。",
      },
    ],
    compare: [
      { head: "アルバイト（モモ）が shop にログイン", off: "できる", on: "できない（Permission denied）" },
      { head: "店長（pochi）が shop にログイン", off: "できる", on: "できる" },
      { head: "設定を反映するには", off: "—", on: "sssd.conf を書いて systemctl restart sssd" },
    ],
    summary: ["SSSD は、何もしないと名簿の全員をログインさせる（permit）", "ldap_access_filter で、入れる人をしぼれる", "sssd.conf は書いただけでは効かない。restart で読みこむ"],
    quiz: {
      q: "sssd.conf を書きかえたのに、設定が変わらない。なぜ？",
      choices: ["LDAP サーバーを再起動していない", "systemctl restart sssd をしていない（読みこみ前）", "パスワードがまちがっている"],
      answer: 1,
      explain: "動いている SSSD は、読みこんだときの設定のままです。restart（または reload）で新しい sssd.conf を読みこみます。",
    },
  },
];

/* ------------------------------------------------------------ 補助 */

function newUser(h: (pw: string) => string, uid: string, cn: string, title: string, uidNumber: number, pw: string): string {
  return (
    `dn: uid=${uid},ou=people,${SUFFIX}\n` +
    "objectClass: inetOrgPerson\nobjectClass: posixAccount\n" +
    `uid: ${uid}\ncn: ${cn}\nsn: ${cn}\ntitle: ${title}\nmail: ${uid}@wanko.shop\n` +
    `uidNumber: ${uidNumber}\ngidNumber: 10000\nhomeDirectory: /home/${uid}\nloginShell: /bin/bash\nuserPassword: ${h(pw)}\n`
  );
}

export const cardById = (id: string) => CARDS.find((c) => c.id === id);
/** 文の中の **ことば** を分ける */
export const splitStudy = (text: string) => text.split("**");

