/**
 * 勉強部屋（LDAP）の台本：「設定カード」。1枚のカードで、1つの設定を学ぶ（はじめに だけは、ことばを学ぶ）。
 *
 * どのカードも同じかたち：
 *   1. まず **設定なし** で、本物のコマンドを打ってみる → どう動くか（たいてい、あぶない・こまる・うごかない）を見る
 *   2. **設定を入れる**（本物の ldapmodify・ldapadd・sssd.conf の書きかえ）
 *   3. **設定あり** で、同じことをもう一度 → 何が変わったかを見る
 *   4. **落とし穴**（書き忘れ・順番・入れる前からのデータ など、設定の「効き方」のくせ）
 *   5. 見くらべる（同じコマンドを、設定なし・ありのまっさらな名簿で本当に動かして並べる）→ わかったこと → クイズ → 自由に試す
 *
 * ステップの cmd は、ボタンを押すとターミナルで本当に動く（しくみは ldap.ts / ldap-shell.ts）。
 * pre があれば、先に別のコンピューターでそのコマンドを動かす（設定を変える など）。どちらもターミナルに出す。
 * fuzz（scripts/fuzz-infra.mjs）で、どのカードも最初から最後まで通して、ok が通る・learn がおかしくない・
 * 見くらべるで設定なし・ありの結果がちがう・自由に試すのコマンドがこわれない、を確かめる。
 */
import { LdapWorld, parseLdif, type HostId } from "./ldap";
import { LdapLab, type ClientConf, type FsNode, type Run, type SssdConf } from "./ldap-shell";
import type { GlyphId } from "./glyphs";

/* ------------------------------------------------------------ 型 */

/** learn＝ことばを覚える（はじめに）、off＝設定なしの実演、apply＝設定を入れる、on＝設定ありの実演、trap＝落とし穴 */
export type Phase = "learn" | "off" | "apply" | "on" | "trap";

export type StudyStep = {
  say: string;
  host: HostId;
  /** ボタンで動かすコマンド（本物の形） */
  cmd: string;
  phase: Phase;
  /** cmd の前に動かすコマンド（設定を変える など。ターミナルにも出す） */
  pre?: { host: HostId; cmd: string };
  /** cmd を動かす前にやること（設定ファイルの書きかえなど、コマンドでないこと） */
  before?: (lab: LdapLab) => void;
  /** before でやったことの見出し（ターミナルに「⚙ …を書きかえた」と出す） */
  beforeNote?: string;
  /** 思ったとおりの結果か（ちがえば retry でもう一度） */
  ok?: (r: Run) => boolean;
  retry?: string;
  learn: string | ((r: Run) => string);
  /** 返事といっしょに開くとよいパネル */
  show?: Panel[];
  /** 「サーバーの中」で先に見せる説明の目じるし（trace の ref。なければ knob.ref） */
  why?: string;
  /** apply のステップで、cmd が「効き目を見るだけ」のとき false（見くらべる・自由に試すで設定を入れるときは動かさない） */
  prep?: false;
};
export type Panel = "trace" | "packets" | "logs" | "tree" | "config";

export type Knob = {
  /** 設定の目じるし（trace の ref と合わせる） */
  ref: string;
  title: string;
  /** どこの設定か */
  where: string;
  off: string;
  on: string;
  /** いまの設定が「あり」か（スイッチに出す） */
  isOn: (lab: LdapLab) => boolean;
};

export type Quiz = { q: string; choices: string[]; answer: number; explain: string };
export type CompareRow = { head: string; off: string; on: string };
export type Try = { label: string; host: HostId; cmd: string };

export type StudyCard = {
  id: string;
  /** 0 は はじめに */
  no: number;
  chapter: number;
  icon: GlyphId;
  color: string;
  title: string;
  sub: string;
  /** はじめの説明（フレブル先生） */
  intro: string;
  analogy?: string;
  /** 学ぶ設定（はじめに には、ない） */
  knob?: Knob;
  /** シナリオを作る（毎回まっさらから） */
  build: (seed: number) => LdapLab;
  steps: StudyStep[];
  /** 見くらべる：同じコマンドを、設定なし・ありのまっさらな名簿で1回ずつ動かす */
  probe?: { host: HostId; cmd: string; note?: string; label?: (r: Run) => string };
  compare?: CompareRow[];
  /** ことばのまとめ（はじめに） */
  words?: { term: string; mean: string }[];
  /** 自由に試すで出す、ためしてみたいコマンド */
  tries: Try[];
  summary: string[];
  quiz: Quiz;
};

export const CHAPTERS = [
  { no: 0, title: "はじめに", sub: "LDAP の名簿と、ことば" },
  { no: 1, title: "名簿をつくる", sub: "管理者・書ける項目" },
  { no: 2, title: "名簿を守る", sub: "だれが・どこまで・どの通り道で" },
  { no: 3, title: "名簿を正しく保つ", sub: "グループ・消した人・番号" },
  { no: 4, title: "名簿を使う", sub: "速さ・サーバーへのログイン" },
] as const;

/** 名簿の種（同じカードは、いつも同じ名簿・同じハッシュ） */
export const SEED_BASE = 1000;

/* ------------------------------------------------------------ 共通のシナリオ（わんこ商店の名簿） */

const SUFFIX = "dc=wanko,dc=shop";
const ADMIN = "cn=admin,dc=wanko,dc=shop";
export const ADMIN_PW = "kanri-pass";

/** それぞれの正しいパスワード（台本で使う。ssh では本人が打ったことにする） */
export const PW = { pochi: "Pochi#2026", hana: "Hana@0701", momo: "Momo*0303", kuro: "Kuro&1120" } as const;

const DN = (uid: string) => `uid=${uid},ou=people,${SUFFIX}`;
const AS_ADMIN = `-x -D "${ADMIN}" -w ${ADMIN_PW}`;
const AS = (uid: keyof typeof PW) => `-x -D "${DN(uid)}" -w '${PW[uid]}'`;

type PersonOpt = { uid: string; cn: string; sn: string; title: string; n: number; pw: string; posix?: boolean };

function personLdif(h: (pw: string) => string, p: PersonOpt): string {
  const lines = [
    `dn: ${DN(p.uid)}`,
    "objectClass: inetOrgPerson",
    ...(p.posix === false ? [] : ["objectClass: posixAccount"]),
    `uid: ${p.uid}`,
    `cn: ${p.cn}`,
    `sn: ${p.sn}`,
    `title: ${p.title}`,
    `mail: ${p.uid}@wanko.shop`,
    `telephoneNumber: 080-0000-${1000 + p.n}`,
  ];
  if (p.posix !== false) lines.push(`uidNumber: ${10000 + p.n}`, "gidNumber: 10000", `homeDirectory: /home/${p.uid}`, "loginShell: /bin/bash");
  lines.push(`userPassword: ${h(p.pw)}`);
  return lines.join("\n") + "\n";
}

const PEOPLE: PersonOpt[] = [
  { uid: "pochi", cn: "ポチ", sn: "柴田", title: "店長", n: 1, pw: PW.pochi },
  { uid: "hana", cn: "ハナ", sn: "秋田", title: "副店長", n: 2, pw: PW.hana },
  { uid: "momo", cn: "モモ", sn: "白井", title: "スタッフ", n: 4, pw: PW.momo },
  { uid: "kuro", cn: "クロ", sn: "黒木", title: "スタッフ", n: 5, pw: PW.kuro },
];

function newUser(h: (pw: string) => string, uid: string, cn: string, uidNumber: number, pw: string, home = true): string {
  return (
    `dn: ${DN(uid)}\n` +
    "objectClass: inetOrgPerson\nobjectClass: posixAccount\n" +
    `uid: ${uid}\ncn: ${cn}\nsn: ${cn}\ntitle: 新人\nmail: ${uid}@wanko.shop\n` +
    `uidNumber: ${uidNumber}\ngidNumber: 10000\n${home ? `homeDirectory: /home/${uid}\n` : ""}loginShell: /bin/bash\nuserPassword: ${h(pw)}\n`
  );
}

/** cn=config を変える LDIF（LDAP サーバーの中で ldapmodify -Y EXTERNAL -H ldapi:/// -f …） */
const mdb = (body: string) => `dn: olcDatabase={1}mdb,cn=config\nchangetype: modify\n${body}`;
const overlayLdif = (name: string, oc: string, extra = "") =>
  `dn: cn=module{0},cn=config\nchangetype: modify\nadd: olcModuleLoad\nolcModuleLoad: ${name}\n\n` +
  `dn: olcOverlay=${name},olcDatabase={1}mdb,cn=config\nchangetype: add\nobjectClass: olcOverlayConfig\nobjectClass: ${oc}\nolcOverlay: ${name}\n${extra}`;

/** シナリオの材料（カードごとに、いるものだけ） */
type Recipe = {
  /** cn=config をいじる（nis を外す など） */
  cfg?: (w: LdapWorld) => void;
  /** 人を posixAccount にするか（既定: する） */
  posix?: boolean;
  /** admin グループに入れる人（uid） */
  adminMembers?: string[];
  /** 名簿を水増しする数（インデックスの実演） */
  bulk?: number;
  /** reader（SSSD が名簿を読むアカウント）を置くか */
  reader?: boolean;
  sssd?: Partial<SssdConf>;
  client?: Partial<Record<HostId, Partial<ClientConf>>>;
  fs?: Record<string, FsNode>;
  /** ssh で使う、本人の正しいパスワード */
  cast?: Record<string, string>;
  /** それぞれのホストに置くファイル（LDIF など）。h＝ハッシュを作る関数 */
  files?: (h: (pw: string) => string) => Partial<Record<HostId, Record<string, string>>>;
};

function scenario(seed: number, r: Recipe): LdapLab {
  const w = new LdapWorld({ seed });
  w.cfg.rootPW = w.hash(ADMIN_PW);
  w.cfg.index.set("uid", new Set(["eq"]));
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
  recs.push(`dn: cn=admin,ou=groups,${SUFFIX}\nobjectClass: groupOfNames\ncn: admin\ndescription: お店の管理グループ\n${members.map((m) => `member: ${DN(m)}`).join("\n")}\n`);
  if (r.reader) {
    recs.push(`dn: ou=apps,${SUFFIX}\nobjectClass: organizationalUnit\nou: apps\n`);
    recs.push(`dn: cn=reader,ou=apps,${SUFFIX}\nobjectClass: organizationalRole\nobjectClass: simpleSecurityObject\ncn: reader\ndescription: SSSD が名簿を読むアカウント\nuserPassword: ${h("Reader-2026")}\n`);
  }
  const parsed = parseLdif(recs.join("\n"), true);
  if (parsed.error) throw new Error(`scenario LDIF: ${parsed.error.line} ${parsed.error.text}`);
  w.load(parsed.records);
  return new LdapLab({
    server: w,
    files: r.files?.(h) ?? {},
    sssd: r.sssd,
    client: r.client,
    fs: r.fs,
    cast: r.cast ?? Object.fromEntries(PEOPLE.map((p) => [p.uid, p.pw])),
  });
}

/* ------------------------------------------------------------ 小物 */

/** 返事の中に、その文字をふくむ行があるか（エラーの行はのぞく） */
const has = (r: Run, text: string) => r.out.some((l) => !l.err && l.text.includes(text));
/** userPassword の行が返ってきたか */
const hasPw = (r: Run) => r.out.some((l) => /^userPassword:/i.test(l.text.trim()));
const ok = (r: Run) => r.exit === 0;
/** その実行の検索で、何件返ったか */
const searchHits = (r: Run) => r.ops.find((o) => o.kind === "search")?.hits?.length ?? 0;
const scanned = (r: Run) => r.ops.find((o) => o.kind === "search")?.scanned ?? 0;
const indexed = (r: Run) => Boolean(r.ops.find((o) => o.kind === "search")?.indexed);
/** ネットワークに、パスワードがそのまま流れたか */
const leaked = (r: Run) => r.packets.some((p) => p.proto === "LDAP" && p.secretText);
const num = (n: number) => n.toLocaleString("en-US");

/* ------------------------------------------------------------ カード */

export const CARDS: StudyCard[] = [
  /* 0. はじめに ---------------------------------------------------------- */
  {
    id: "basics",
    no: 0,
    chapter: 0,
    icon: "db",
    color: "#67e8f9",
    title: "LDAP ってなに？",
    sub: "名簿の木・DN・さがす・ログイン",
    intro:
      "LDAP は、会社やお店の **名簿**（だれがいて、どのグループで、どんなパスワードか）をしまっておくサーバーです。いろいろなサーバーやアプリが、この名簿を見て「この人を入れていいか」を決めます。まずは名簿をのぞいて、このあと何度も出てくる ことば を覚えよう。",
    analogy: "会社の「社員名簿」と「社員証の受付」が、いっしょになったもの。",
    build: (seed) => scenario(seed, {}),
    steps: [
      {
        say: "わんこ商店の名簿から、店長の pochi をさがそう。**ldapsearch** は名簿をさがすコマンド。-x はふつうのログインのしかた、-LLL は見やすく出す、という意味です。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)"`,
        phase: "learn",
        ok: (r) => ok(r) && has(r, `dn: ${DN("pochi")}`),
        learn:
          "名簿の1人ぶんを **エントリ** といいます。いちばん上の dn: が、名簿の中の住所（**DN**）。cn（名前）・mail（メール）などの項目を **属性** といいます。日本語は base64 という形で出てきます（cn:: 44Od44OB ＝ ポチ）。userPassword まで見えているのは、まだ守る設定をしていないからです（設定 4 で直します）。",
        show: ["tree"],
      },
      {
        say: "DN は「右から読むと、木の上から」。スタッフのたな（ou=people）の **すぐ下だけ** を見てみよう。-b はさがしはじめる場所（**ベース**）、-s one は「すぐ下だけ」（**スコープ**）です。",
        host: "pc",
        cmd: `ldapsearch -x -LLL -b "ou=people,${SUFFIX}" -s one "(objectClass=*)" uid`,
        phase: "learn",
        ok: (r) => ok(r) && searchHits(r) >= 4,
        learn: (r) =>
          `スタッフ ${searchHits(r)}人が出てきました。uid=pochi,ou=people,dc=wanko,dc=shop は「わんこ商店（dc=wanko,dc=shop）の、スタッフのたな（ou=people）の、pochi」という住所です。(objectClass=*) は「なんでも」という **フィルタ** です。`,
      },
      {
        say: "フィルタで、さがす人をしぼれます。(|…) は「または」。pochi か hana の、メールだけを出そう（うしろの mail が「出してほしい属性」）。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(|(uid=pochi)(uid=hana))" mail`,
        phase: "learn",
        ok: (r) => ok(r) && searchHits(r) === 2,
        learn: "2人だけが出てきました。(&…) は「かつ」、(!…) は「〜ではない」、(cn=po*) のように * をつけると「〜で始まる」。組み合わせて、ほしい人だけを取り出せます。",
      },
      {
        say: "LDAP は、ログインの確認にも使います。pochi の DN とパスワードで「わたしです」と名のってみよう。これを **バインド** といいます。**ldapwhoami** は「わたしはだれ？」と聞くコマンドです。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        phase: "learn",
        ok: (r) => ok(r) && has(r, `dn:${DN("pochi")}`),
        learn: "「あなたは uid=pochi です」と返ってきました。-D がだれか（DN）、-w がパスワード。いろいろなサーバーやアプリが、こうして LDAP にパスワードを確かめてもらっています。",
        show: ["trace"],
      },
      {
        say: "パスワードをまちがえると、どうなるかな？",
        host: "pc",
        cmd: `ldapwhoami -x -D "${DN("pochi")}" -w 'machigai'`,
        phase: "learn",
        ok: (r) => r.exit === 49,
        learn: "**49 Invalid credentials**（ログインできない）。LDAP の返事には、結果を表す番号（**結果コード**）がつきます。0 が成功、49 はログインできない、32 は見つからない…。このあとのカードでも、たくさん出てきます。",
        show: ["trace"],
      },
      {
        say: "LDAP サーバー（slapd）のふるまいは、**設定** で決まります。設定も名簿と同じ形（**cn=config**）でしまわれています。LDAP サーバーの中から、のぞいてみよう。",
        host: "ldap",
        cmd: `ldapsearch -Y EXTERNAL -H ldapi:/// -LLL -o ldif-wrap=no -b cn=config "(olcDatabase={1}mdb)" olcSuffix olcRootDN olcDbIndex`,
        phase: "learn",
        ok: (r) => ok(r) && has(r, `olcSuffix: ${SUFFIX}`),
        learn: "olcSuffix（この名簿のてっぺん）・olcRootDN（管理者）・olcDbIndex（さくいん）などが書いてあります。つぎのカードから、こうした設定を1つずつ「なし」と「あり」で比べていきます。",
        show: ["config"],
      },
    ],
    words: [
      { term: "エントリ", mean: "名簿の1件（1人・1グループ）" },
      { term: "DN", mean: "名簿の中の住所。右から読むと、木の上から" },
      { term: "属性", mean: "cn・mail・userPassword などの項目" },
      { term: "フィルタ", mean: "(uid=pochi) のような、さがす条件。& かつ・| または・! ではない" },
      { term: "バインド", mean: "DN とパスワードで名のる（ログイン）" },
      { term: "結果コード", mean: "0 成功・49 ログインできない・32 見つからない・50 権限がない" },
      { term: "cn=config", mean: "サーバーの設定。名簿と同じ形で読み書きする" },
    ],
    tries: [
      { label: "pochi をさがす", host: "pc", cmd: `ldapsearch -x -LLL "(uid=pochi)"` },
      { label: "店長以外のスタッフ", host: "pc", cmd: `ldapsearch -x -LLL -b "ou=people,${SUFFIX}" "(!(uid=pochi))" uid` },
      { label: "グループの中", host: "pc", cmd: `ldapsearch -x -LLL -b "ou=groups,${SUFFIX}" "(objectClass=groupOfNames)" member` },
      { label: "見えない属性（+）", host: "pc", cmd: `ldapsearch -x -LLL "(uid=hana)" +` },
      { label: "ない場所をさがす", host: "pc", cmd: `ldapsearch -x -LLL -b "ou=nai,${SUFFIX}" "(uid=pochi)"` },
      { label: "使えるコマンド", host: "pc", cmd: "help" },
    ],
    summary: ["LDAP＝名簿のサーバー。名簿は木の形", "1件＝エントリ、住所＝DN、項目＝属性", "さがす＝ldapsearch（ベース・スコープ・フィルタ）", "ログインの確認＝バインド。49 はログインできない", "サーバーのふるまいは cn=config の設定で決まる"],
    quiz: {
      q: "DN「uid=hana,ou=people,dc=wanko,dc=shop」で、木のいちばん上（お店）を表すのは？",
      choices: ["uid=hana", "ou=people", "dc=wanko,dc=shop"],
      answer: 2,
      explain: "DN は右へいくほど木の上。いちばん右の dc=wanko,dc=shop が、この名簿のてっぺん（olcSuffix）です。",
    },
  },

  /* 1. 管理者のパスワード ------------------------------------------------ */
  {
    id: "rootpw",
    no: 1,
    chapter: 1,
    icon: "waf",
    color: "#ffc857",
    title: "管理者のパスワード",
    sub: "olcRootPW — 名簿のぜんぶを動かせる人",
    intro:
      "LDAP サーバーには、名簿のぜんぶを読み書きできる **管理者**（olcRootDN。ここでは cn=admin）がいます。でも、そのパスワード（**olcRootPW**）を決めておかないと、管理者でもログインできません。まずは「設定なし」で入ろうとして、できないのを見てみよう。",
    analogy: "金庫の持ち主でも、暗証番号を決めていなければ開けられないのと同じ。",
    knob: { ref: "rootpw", title: "olcRootPW（管理者のパスワード）", where: "olcDatabase={1}mdb,cn=config", off: "決めていない", on: "{SSHA} のハッシュで決めた", isOn: (lab) => lab.server.cfg.rootPW != null },
    build: (seed) =>
      scenario(seed, {
        cfg: (w) => (w.cfg.rootPW = null),
        files: (h) => ({ ldap: { "rootpw.ldif": mdb(`replace: olcRootPW\nolcRootPW: ${h(ADMIN_PW)}\n`) } }),
      }),
    steps: [
      {
        say: "あなたのパソコンから、管理者（cn=admin）でログインできるか試そう。",
        host: "pc",
        cmd: `ldapwhoami ${AS_ADMIN}`,
        phase: "off",
        ok: (r) => r.exit === 49,
        learn: "**49**（ログインできない）。cn=admin は olcRootDN（管理者）なのに、**olcRootPW** を決めていないので、サーバーはパスワードを確かめられませんでした。名簿の中にも cn=admin のエントリはありません。",
        show: ["trace"],
      },
      {
        say: "LDAP サーバーの中で、パスワードのハッシュを作ろう。**slappasswd** は、パスワードを {SSHA} というハッシュに変える道具です。",
        host: "ldap",
        cmd: `slappasswd -s ${ADMIN_PW}`,
        phase: "apply",
        prep: false,
        ok,
        learn: "**{SSHA}…** ができました。塩（ソルト）をまぜてハッシュにするので、同じパスワードでも作るたびに文字が変わります。それでも、どれも kanri-pass で通ります。パスワードはこうして「元にもどせない形」で書きます。",
      },
      {
        say: "ハッシュを olcRootPW に書こう。**ldapmodify -Y EXTERNAL -H ldapi:///** は、LDAP サーバーの中から root の資格で、設定（cn=config）を書きかえる決まり文句です。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f rootpw.ldif",
        phase: "apply",
        ok,
        learn: "**olcRootPW** を書きました。cn=config の設定は、サーバーを再起動しなくても、**すぐに効きます**。",
        show: ["config"],
      },
      {
        say: "もう一度、管理者でログインしてみよう。",
        host: "pc",
        cmd: `ldapwhoami ${AS_ADMIN}`,
        phase: "on",
        ok: (r) => ok(r) && has(r, `dn:${ADMIN}`),
        retry: "まだ入れませんでした。先に設定を入れたか確かめよう。",
        learn: "入れました！ サーバーが「あなたは dn:cn=admin,dc=wanko,dc=shop」と答えています。管理者は olcAccess（アクセス制御）にもしばられない、名簿のマスターキーです。",
        show: ["trace"],
      },
      {
        say: "管理者は、ほかの人のパスワードのハッシュも読めるかな？",
        host: "pc",
        cmd: `ldapsearch ${AS_ADMIN} -LLL "(uid=hana)" userPassword`,
        phase: "on",
        ok: (r) => ok(r) && hasPw(r),
        learn: "読めました。管理者は何でもできるので、olcRootPW はかんたんに知られないように。ふだんの仕事は、権限をしぼったアカウントでやるのが本物のやり方です。",
        show: ["trace"],
        why: "rootdn",
      },
    ],
    probe: { host: "pc", cmd: `ldapwhoami ${AS_ADMIN}`, label: (r) => (ok(r) ? "管理者としてログインできた" : "管理者でも入れない") },
    compare: [
      { head: "管理者でログイン", off: "49（できない）", on: "成功（dn:cn=admin…）" },
      { head: "名簿の読み書き", off: "だれもできない", on: "なんでもできる（olcAccess もとびこえる）" },
      { head: "パスワードの形", off: "—", on: "{SSHA}（元にもどせないハッシュ）" },
    ],
    tries: [
      { label: "管理者でログイン", host: "pc", cmd: `ldapwhoami ${AS_ADMIN}` },
      { label: "まちがったパスワード", host: "pc", cmd: `ldapwhoami -x -D "${ADMIN}" -w machigai` },
      { label: "ハッシュを作る", host: "ldap", cmd: `slappasswd -s ${ADMIN_PW}` },
      { label: "いまの olcRootPW", host: "ldap", cmd: `ldapsearch -Y EXTERNAL -H ldapi:/// -LLL -o ldif-wrap=no -b cn=config "(olcDatabase={1}mdb)" olcRootDN olcRootPW` },
    ],
    summary: ["管理者（olcRootDN）も、olcRootPW を決めないとログインできない", "パスワードは slappasswd で {SSHA} ハッシュにして書く", "cn=config の設定は、再起動しなくてもすぐ効く", "管理者は何でもできる。ふだんは権限をしぼったアカウントで"],
    quiz: {
      q: "olcRootPW を決めていないと、管理者（cn=admin）はどうなる？",
      choices: ["パスワードなしで入れる", "ログインできない（49）", "匿名として入れる"],
      answer: 1,
      explain: "パスワードを確かめるもと（olcRootPW）がないので、正しいパスワードを打っても 49（Invalid credentials）になります。",
    },
  },

  /* 2. スキーマ ---------------------------------------------------------- */
  {
    id: "schema",
    no: 2,
    chapter: 1,
    icon: "db",
    color: "#b08cff",
    title: "知らない言葉は書けない",
    sub: "スキーマ — posixAccount・uidNumber を使うには",
    intro:
      "名簿に書ける属性や、エントリの種類（objectClass）は、**スキーマ** で決まっています。Linux のログインに使う **posixAccount**（uidNumber・homeDirectory など）は、**nis** というスキーマに入っています。読みこんでいないと、サーバーは「そんな言葉は知らない」と断ります。",
    analogy: "書類の書式。書式にない欄には書けないし、「必ず書く欄」が空でも受けつけてもらえない。",
    knob: { ref: "schema:nis", title: "nis スキーマ", where: "cn=schema,cn=config", off: "読みこんでいない", on: "読みこんだ", isOn: (lab) => lab.server.cfg.schemas.has("nis") },
    build: (seed) =>
      scenario(seed, {
        posix: false,
        cfg: (w) => w.cfg.schemas.delete("nis"),
        files: (h) => ({
          ldap: { "nis.ldif": "dn: cn=nis,cn=schema,cn=config\nchangetype: add\nobjectClass: olcSchemaConfig\ncn: nis\n" },
          pc: {
            "momo-posix.ldif": `dn: ${DN("momo")}\nchangetype: modify\nadd: objectClass\nobjectClass: posixAccount\n-\nadd: uidNumber\nuidNumber: 10004\n-\nadd: gidNumber\ngidNumber: 10000\n-\nadd: homeDirectory\nhomeDirectory: /home/momo\n`,
            "shiro-nohome.ldif": newUser(h, "shiro", "シロ", 10006, "Shiro$2026", false),
          },
        }),
      }),
    steps: [
      {
        say: "モモに、Linux のログイン情報（**posixAccount**）を足そう。まだ nis スキーマは読みこんでいません。",
        host: "pc",
        cmd: `ldapmodify ${AS_ADMIN} -f momo-posix.ldif`,
        phase: "off",
        ok: (r) => r.exit === 21 || r.exit === 17,
        learn: "**21**（知らない値）で断られました。nis スキーマを読みこんでいないので、サーバーは posixAccount という種類も、uidNumber という属性も知らないのです。",
        show: ["trace"],
      },
      {
        say: "nis スキーマを読みこもう。スキーマも cn=config の中に足します。",
        host: "ldap",
        cmd: "ldapadd -Y EXTERNAL -H ldapi:/// -f nis.ldif",
        phase: "apply",
        ok,
        learn: "**nis** スキーマを読みこみました。posixAccount・uidNumber・homeDirectory などが使えます（読みこんだスキーマは、あとから消せません）。",
        show: ["config"],
      },
      {
        say: "もう一度、モモに posixAccount を足そう。",
        host: "pc",
        cmd: `ldapmodify ${AS_ADMIN} -f momo-posix.ldif`,
        phase: "on",
        ok,
        retry: "まだ断られました。先にスキーマを読みこんだか確かめよう。",
        learn: "こんどは成功！ サーバーが posixAccount を知ったので、Linux のログインに使う情報を名簿に書けました。",
      },
      {
        say: "モモに uidNumber が入ったか、確かめよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=momo)" objectClass uidNumber homeDirectory`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "uidNumber: 10004"),
        learn: "posixAccount・uidNumber・homeDirectory が入りました。お店のサーバーは、この情報でモモを Linux のユーザーとして扱えます（設定 11 で使います）。",
      },
      {
        say: "落とし穴：新人シロを、**homeDirectory を書き忘れて** 足してみよう。",
        host: "pc",
        cmd: `ldapadd ${AS_ADMIN} -f shiro-nohome.ldif`,
        phase: "trap",
        ok: (r) => r.exit === 65,
        learn: "**65**（オブジェクトクラスの決まりに合わない）。スキーマは「使える言葉」だけでなく、「**必ず書く属性**（MUST）」も決めています。posixAccount には homeDirectory が必ず要るのです。",
        show: ["trace"],
      },
    ],
    probe: { host: "pc", cmd: `ldapmodify ${AS_ADMIN} -f momo-posix.ldif`, label: (r) => (ok(r) ? "posixAccount を書けた" : "posixAccount を知らないので書けない") },
    compare: [
      { head: "posixAccount を足す", off: "21（知らない）", on: "成功" },
      { head: "uidNumber・homeDirectory", off: "使えない", on: "使える（Linux のログインに）" },
      { head: "必ず書く属性（MUST）", off: "—", on: "書き忘れると 65" },
    ],
    tries: [
      { label: "posixAccount を足す", host: "pc", cmd: `ldapmodify ${AS_ADMIN} -f momo-posix.ldif` },
      { label: "MUST を忘れる", host: "pc", cmd: `ldapadd ${AS_ADMIN} -f shiro-nohome.ldif` },
      { label: "モモを見る", host: "pc", cmd: `ldapsearch -x -LLL "(uid=momo)" objectClass uidNumber homeDirectory` },
      { label: "LDIF を見る", host: "pc", cmd: "cat momo-posix.ldif" },
    ],
    summary: ["書ける属性・種類はスキーマで決まる", "Linux のログイン用の posixAccount は nis スキーマ", "知らない種類は 21、必ず書く属性（MUST）を忘れると 65", "スキーマは使う前に読みこむ（あとから消せない）"],
    quiz: {
      q: "posixAccount に homeDirectory を書かずに足そうとすると？",
      choices: ["成功する", "65（必ず書く属性がない）で断られる", "homeDirectory が自動で入る"],
      answer: 1,
      explain: "posixAccount は homeDirectory を必ず書く属性（MUST）にしているので、書かないと 65（Object class violation）になります。",
    },
  },

  /* 3. 匿名アクセス ------------------------------------------------------ */
  {
    id: "anon",
    no: 3,
    chapter: 2,
    icon: "user",
    color: "#9fb4ff",
    title: "名前を言わない人にも見せる？",
    sub: "olcDisallows: bind_anon — 匿名のログイン",
    intro:
      "LDAP は、何も設定しないと **匿名**（名前もパスワードも言わない人）でも名簿を読めます。スタッフの名前・役職・メールが、だれにでも見える状態です。まず匿名で、どこまで読めるか見てみよう。",
    analogy: "受付にだれもいなくて、社員名簿が玄関に置きっぱなしになっているようなもの。",
    knob: { ref: "anon:disallow", title: "olcDisallows: bind_anon", where: "cn=config", off: "匿名でも入れる", on: "匿名のログインを断る", isOn: (lab) => lab.server.cfg.disallowAnon },
    build: (seed) => scenario(seed, { files: () => ({ ldap: { "no-anon.ldif": "dn: cn=config\nchangetype: modify\nadd: olcDisallows\nolcDisallows: bind_anon\n" } }) }),
    steps: [
      {
        say: "名前もパスワードも言わずに（匿名で）、スタッフ全員の名前・役職・メールをさがそう。-D を書かないと、匿名になります。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(objectClass=person)" cn title mail`,
        phase: "off",
        ok: (r) => ok(r) && searchHits(r) >= 4 && has(r, "pochi@wanko.shop"),
        learn: (r) => `匿名なのに、スタッフ ${searchHits(r)}人の名前・役職・メールが全部読めてしまいました。だれが店長か、だれにメールすればいいかまで、外から分かってしまいます。`,
        show: ["trace"],
      },
      {
        say: "匿名のログインを断る設定（**olcDisallows: bind_anon**）を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f no-anon.ldif",
        phase: "apply",
        ok,
        learn: "**bind_anon**（匿名のバインド）を禁止にしました。cn=config なので、すぐに効きます。",
        show: ["config"],
      },
      {
        say: "もう一度、匿名で同じさがしものをしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(objectClass=person)" cn title mail`,
        phase: "on",
        ok: (r) => r.exit === 48,
        retry: "まだ読めてしまいました。設定が入ったか確かめよう。",
        learn: "**48**（そのログインのしかたは使えない）で断られました。ldapsearch は、まず匿名でバインドします。そこで bind_anon に止められたのです。",
        show: ["trace"],
      },
      {
        say: "ちゃんとログインした人なら、読めるはず。pochi としてログインしてから、hana をさがそう。",
        host: "pc",
        cmd: `ldapsearch ${AS("pochi")} -LLL "(uid=hana)" cn mail`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "hana@wanko.shop"),
        learn: "ログインした人には見えます。「だれでも」から「名のった人だけ」に変わりました。お店のアプリや SSSD も、専用のアカウントでログインしてから名簿を読みます。",
      },
    ],
    probe: { host: "pc", cmd: `ldapsearch -x -LLL "(objectClass=person)" cn title mail`, label: (r) => (searchHits(r) ? `${searchHits(r)}人の名前・役職・メールが見えた` : "名簿は何も見えない") },
    compare: [
      { head: "匿名でさがす", off: "全員の情報が読める", on: "48（断られる）" },
      { head: "ログインした人", off: "読める", on: "読める" },
      { head: "もっと強く", off: "—", on: "olcRequires: authc（バインドしないお願いも断る）" },
    ],
    tries: [
      { label: "匿名でさがす", host: "pc", cmd: `ldapsearch -x -LLL "(objectClass=person)" cn title mail` },
      { label: "ログインしてさがす", host: "pc", cmd: `ldapsearch ${AS("pochi")} -LLL "(uid=hana)" cn mail` },
      { label: "匿名で「わたしはだれ？」", host: "pc", cmd: "ldapwhoami -x" },
      { label: "サーバーのてっぺん（ルート DSE）", host: "pc", cmd: `ldapsearch -x -LLL -s base -b "" namingContexts` },
    ],
    summary: ["LDAP は何もしないと、匿名でも名簿を読める", "olcDisallows: bind_anon で、匿名のバインドを断れる（48）", "olcRequires: authc で、バインドしないお願いも断れる", "アプリは専用のアカウントでログインして読む"],
    quiz: {
      q: "olcDisallows: bind_anon を入れると、どうなる？",
      choices: ["サーバーが止まる", "名前を言わないログイン（匿名）が断られる", "管理者も入れなくなる"],
      answer: 1,
      explain: "匿名のバインドだけを断ります。DN とパスワードでログインする人には、今までどおり見えます。",
    },
  },

  /* 4. アクセス制御（ACL） ------------------------------------------------ */
  {
    id: "acl",
    no: 4,
    chapter: 2,
    icon: "lb",
    color: "#ffc857",
    title: "だれに、どこまで見せる？",
    sub: "olcAccess — パスワードのハッシュを守る",
    intro:
      "**userPassword**（パスワードのハッシュ）は、他人に見せてはいけません。**olcAccess** は「どこを（to）・だれが（by）・どこまでできるか」を決める行で、**上から順に見て、最初に当たった行で決まります**。何も書かないと、OpenLDAP は「だれでも読める」ので、ハッシュまで読めてしまいます。",
    analogy: "図書館で、ふつうの本はだれでも読めるけれど、個人情報のファイルは本人だけ、と棚ごとに決める貼り紙。",
    knob: { ref: "acl", title: "olcAccess（アクセス制御）", where: "olcDatabase={1}mdb,cn=config", off: "書いていない（だれでも読める）", on: "userPassword は本人だけ", isOn: (lab) => lab.server.cfg.acl.length > 0 },
    build: (seed) =>
      scenario(seed, {
        files: () => ({
          ldap: {
            "acl.ldif": mdb("replace: olcAccess\nolcAccess: {0}to attrs=userPassword\n  by self write\n  by anonymous auth\n  by * none\nolcAccess: {1}to *\n  by * read\n"),
            "acl-noauth.ldif": mdb("replace: olcAccess\nolcAccess: {0}to attrs=userPassword\n  by self write\n  by * none\nolcAccess: {1}to *\n  by * read\n"),
            "acl-order.ldif": mdb("replace: olcAccess\nolcAccess: {0}to *\n  by * read\nolcAccess: {1}to attrs=userPassword\n  by self write\n  by anonymous auth\n  by * none\n"),
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
        learn: "パスワードのハッシュ（userPassword:: …）が、だれにでも読めてしまいました。持ち帰られると、時間をかけて元のパスワードを当てられるおそれがあります（とくに弱いパスワード）。",
        show: ["trace"],
      },
      {
        say: "olcAccess を2行書こう。{0} は「userPassword は、本人は書ける／匿名はログインの確認だけ／ほかはだめ」。{1} は「それ以外は、だれでも読める」。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f acl.ldif",
        phase: "apply",
        ok,
        learn: "2行のルールを入れました。**self**＝本人、**anonymous**＝匿名、*＝だれでも。**write**（書ける）・**auth**（ログインの確認だけ）・**none**（だめ）が「どこまで」です。",
        show: ["config"],
      },
      {
        say: "もう一度、匿名で pochi の userPassword をさがそう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword cn`,
        phase: "on",
        ok: (r) => ok(r) && !hasPw(r) && has(r, `dn: ${DN("pochi")}`),
        retry: "まだハッシュが見えています。設定が入ったか確かめよう。",
        learn: "エントリと cn は返るのに、**userPassword だけ外れました**。{0} の行の「by anonymous auth」に当たって、匿名は「確認だけ（auth）」になったからです。",
        show: ["trace", "config"],
      },
      {
        say: "見えなくしても、ログインはできるかな？ pochi でログインしてみよう。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "dn:uid=pochi"),
        learn: "できました！ ログインのとき、サーバーは「匿名の人が userPassword を **auth**（確かめるだけ）できるか」を見ます。by anonymous auth があるから、確かめられたのです。",
        show: ["trace"],
        why: "acl:0:1",
      },
      {
        say: "本人なら、自分のパスワードは変えられるはず。モモが自分のパスワードを変えてみよう（**ldappasswd**）。",
        host: "pc",
        cmd: `ldappasswd ${AS("momo")} -s 'NewMomo#99'`,
        phase: "on",
        ok,
        learn: "変えられました。{0} の「**by self write**」（本人は書ける）に当たったからです。「他人には見せない」と「本人は変えられる」を、1つの行で決めています。",
        show: ["trace"],
        why: "acl:0:0",
      },
      {
        say: "落とし穴①：{0} の行から「**by anonymous auth**」を書き忘れたら…？ 設定を入れかえてから、pochi でログインしてみよう。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        pre: { host: "ldap", cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f acl-noauth.ldif" },
        phase: "trap",
        ok: (r) => r.exit === 49,
        learn: "正しいパスワードなのに **49**！ ログインのときにパスワードを確かめる権限（auth）が、だれにもなくなったからです。全員がログインできなくなる、本物でもよくある事故です。",
        show: ["trace", "config"],
      },
      {
        say: "落とし穴②：こんどは2行の **順番** を入れかえて（{0} が「to * by * read」）、匿名で userPassword をさがしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword`,
        pre: { host: "ldap", cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f acl-order.ldif" },
        phase: "trap",
        ok: (r) => ok(r) && hasPw(r),
        learn: "また見えてしまいました！ olcAccess は **上から順に** 見て、最初に当たった行で決まります。userPassword も {0} の「to *」に当たってしまい、守りの行（{1}）まで届きません。くわしい（せまい）行を、上に書きます。",
        show: ["trace", "config"],
      },
      {
        say: "正しいルール（acl.ldif）にもどして、もう一度たしかめよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword cn`,
        pre: { host: "ldap", cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f acl.ldif" },
        phase: "on",
        ok: (r) => ok(r) && !hasPw(r),
        learn: "userPassword は、また見えなくなりました。olcAccess は「書く順番」と「書き忘れ」で、動きがまるで変わります。",
        show: ["trace"],
      },
    ],
    probe: { host: "pc", cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword cn`, label: (r) => (hasPw(r) ? "パスワードのハッシュが見えた" : "userPassword だけ外れた（cn は見える）") },
    compare: [
      { head: "匿名が userPassword を読む", off: "読める（あぶない）", on: "外して返す" },
      { head: "ログイン（パスワードの確認）", off: "できる", on: "できる（by anonymous auth）" },
      { head: "本人が自分のを変える", off: "できない（50）", on: "できる（by self write）" },
      { head: "auth を書き忘れる", off: "—", on: "全員ログインできない（49）" },
    ],
    tries: [
      { label: "匿名でハッシュを見る", host: "pc", cmd: `ldapsearch -x -LLL "(uid=pochi)" userPassword` },
      { label: "本人が自分のを見る", host: "pc", cmd: `ldapsearch ${AS("pochi")} -LLL "(uid=pochi)" userPassword` },
      { label: "hana が pochi のを見る", host: "pc", cmd: `ldapsearch ${AS("hana")} -LLL "(uid=pochi)" userPassword` },
      { label: "pochi でログイン", host: "pc", cmd: `ldapwhoami ${AS("pochi")}` },
      { label: "hana が自分のパスワードを変える", host: "pc", cmd: `ldappasswd ${AS("hana")} -s 'NewHana#77'` },
      { label: "いまの olcAccess", host: "ldap", cmd: `ldapsearch -Y EXTERNAL -H ldapi:/// -LLL -o ldif-wrap=no -b cn=config "(olcDatabase={1}mdb)" olcAccess` },
    ],
    summary: ["olcAccess がないと、OpenLDAP は「だれでも全部読める」", "上から順に見て、最初に当たった to の行・by で決まる", "userPassword は「self write・anonymous auth・* none」が定番", "auth を書き忘れると全員ログインできない。せまい行を上に"],
    quiz: {
      q: "olcAccess の行は、どの順番で使われる？",
      choices: ["上から順に見て、最初に当たった行", "いちばんきびしい行", "いちばん下の行"],
      answer: 0,
      explain: "olcAccess は {0} から順に見て、当てはまった最初の行で決まります。だから「to *」を上に書くと、下のくわしい行まで届きません。",
    },
  },

  /* 5. 暗号化（TLS） ------------------------------------------------------ */
  {
    id: "tls",
    no: 5,
    chapter: 2,
    icon: "cdn",
    color: "#34d6b8",
    title: "パスワードが、通り道で丸見え？",
    sub: "olcSecurity・StartTLS・ldaps:// — 通り道を暗号にする",
    intro:
      "ログインのとき、パスワードはネットワークを通ってサーバーへ行きます。**暗号にしていない（ldap://）** と、その通り道を流れるバイトの中に、パスワードが **そのまま** 入っています。このパソコンの設定（/etc/openldap/ldap.conf）は、いまは ldap://（暗号なし）でつなぎます。まずそのままログインして、流れたパケットの中を見てみよう。",
    analogy: "ハガキに暗証番号を書いて送るようなもの。配達の途中で、だれでも読める。",
    knob: { ref: "tls:security", title: "olcSecurity: tls=1（暗号を必須に）", where: "cn=config", off: "暗号なしでも話せる", on: "暗号なしのつながりを断る", isOn: (lab) => lab.server.cfg.securityTls > 0 },
    build: (seed) =>
      scenario(seed, {
        client: { pc: { uri: "ldap://ldap.wanko.shop" } },
        files: () => ({ ldap: { "require-tls.ldif": "dn: cn=config\nchangetype: modify\nadd: olcSecurity\nolcSecurity: tls=1\n" } }),
      }),
    steps: [
      {
        say: "pochi でログインしてみよう。そのあと「パケット」を開いて、ネットワークを流れたバイトを見ます。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        phase: "off",
        ok: (r) => ok(r) && leaked(r),
        learn: "ログインは成功。でもパケットを見ると、**パスワード「Pochi#2026」が、そのまま流れています**（赤いところ）。同じネットワークで通り道を見られる人がいれば、読めてしまいます。",
        show: ["packets"],
        why: "tls:client",
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
        say: "同じコマンドで、もう一度ログインしてみよう。パケットも見てね。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        phase: "on",
        ok: (r) => r.exit === 13,
        learn: "**13**（暗号にしないと話せない）で断られました。でもパケットを見ると、**断られる前に、パスワードはもう流れています**！ サーバーは、受け取ってから断るしかないのです。だから、クライアント（あなたのパソコン）の側でも、暗号を使うようにします。",
        show: ["packets", "trace"],
        why: "tls:security",
      },
      {
        say: "**-ZZ**（StartTLS：ldap:// でつないでから、暗号に切りかえる）をつけてログインしよう。",
        host: "pc",
        cmd: `ldapwhoami -x -ZZ -D "${DN("pochi")}" -w '${PW.pochi}'`,
        phase: "on",
        ok: (r) => ok(r) && !leaked(r),
        learn: "成功！ パケットは StartTLS のあいさつのあと「**Application Data**（読めないバイト）」になり、パスワードは見えません。",
        show: ["packets"],
        why: "tls:cert",
      },
      {
        say: "毎回 -ZZ を書くのは忘れやすい。あなたのパソコンの **/etc/openldap/ldap.conf** の URI を ldaps://（はじめから暗号）にしたので、さっきと同じ、何もつけないコマンドで試そう。",
        host: "pc",
        cmd: `ldapwhoami ${AS("pochi")}`,
        before: (lab) => {
          lab.client.pc.uri = "ldaps://ldap.wanko.shop";
        },
        beforeNote: "あなたのパソコンの /etc/openldap/ldap.conf を書きかえた：URI ldap://ldap.wanko.shop → ldaps://ldap.wanko.shop",
        phase: "on",
        ok: (r) => ok(r) && !leaked(r),
        learn: "同じコマンドなのに、こんどははじめから暗号（ldaps:// の 636番）。サーバー側（olcSecurity）で断り、クライアント側（ldap.conf の URI）で最初から暗号にする。**両方で守る** のが本物のやり方です。",
        show: ["packets"],
        why: "tls:client",
      },
    ],
    probe: {
      host: "pc",
      cmd: `ldapwhoami ${AS("pochi")}`,
      note: "olcSecurity は「届いたあとで断る」。断られても、パスワードはもう流れています。クライアントの ldap.conf を ldaps:// にして、はじめから暗号にします（ステップ5）。",
      label: (r) => (ok(r) ? (leaked(r) ? "ログインできた（暗号なしのまま）" : "ログインできた（暗号で）") : leaked(r) ? "断られた。でも、パスワードはもう流れた" : "断られた"),
    },
    compare: [
      { head: "暗号なし（ldap://）でログイン", off: "成功（パスワードが丸見え）", on: "13 で断る（でも、パスワードは流れた）" },
      { head: "-ZZ（StartTLS）・ldaps://", off: "暗号で話せる（使うかは自由）", on: "暗号でしか話せない" },
      { head: "いちばん大事なこと", off: "—", on: "クライアントも ldaps://（ldap.conf の URI）" },
    ],
    tries: [
      { label: "そのままログイン", host: "pc", cmd: `ldapwhoami ${AS("pochi")}` },
      { label: "-ZZ でログイン", host: "pc", cmd: `ldapwhoami -x -ZZ -D "${DN("pochi")}" -w '${PW.pochi}'` },
      { label: "ldaps:// でログイン", host: "pc", cmd: `ldapwhoami -x -H ldaps://ldap.wanko.shop -D "${DN("pochi")}" -w '${PW.pochi}'` },
      { label: "IP アドレスでつなぐ", host: "pc", cmd: `ldapwhoami -x -ZZ -H ldap://192.168.10.2 -D "${DN("pochi")}" -w '${PW.pochi}'` },
      { label: "ldap.conf を見る", host: "pc", cmd: "cat /etc/openldap/ldap.conf" },
    ],
    summary: ["暗号にしないと、パスワードは通り道でそのまま読める", "olcSecurity: tls=1 は「届いたあとで断る」。パスワードは流れてしまう", "StartTLS（-ZZ）か ldaps:// で、通り道を暗号にする", "サーバー（olcSecurity）とクライアント（ldap.conf）の両方で守る"],
    quiz: {
      q: "olcSecurity: tls=1 だけを入れて、クライアントが ldap:// でログインすると？",
      choices: ["パスワードは流れずに、13 で断られる", "13 で断られるが、パスワードはもう流れている", "成功する"],
      answer: 1,
      explain: "サーバーは、パスワードを受け取ってから断るしかありません。だからクライアント側でも、はじめから暗号（ldaps:// か -ZZ）にします。",
    },
  },

  /* 6. パスワードポリシー --------------------------------------------------- */
  {
    id: "ppolicy",
    no: 6,
    chapter: 2,
    icon: "monitor",
    color: "#60a5fa",
    title: "何回まちがえても、だいじょうぶ？",
    sub: "ppolicy — まちがえ続けたら、しばらくロック",
    intro:
      "パスワードを何回まちがえても、何も起きないと、だれかが「総当たり」（かたっぱしから試す）で当ててしまうおそれがあります。**ppolicy** overlay を入れると、「決めた回数まちがえたら、しばらくロック」というルールを使えます。まず、設定なしだとサーバーが何もしないことを見てみよう。",
    analogy: "暗証番号を3回まちがえると、しばらく使えなくなるキャッシュカード。",
    knob: { ref: "ppolicy", title: "ppolicy overlay＋olcPPolicyDefault", where: "olcDatabase={1}mdb,cn=config", off: "数えない（何回でも）", on: "3回まちがえたら300秒ロック", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "ppolicy") },
    build: (seed) =>
      scenario(seed, {
        files: () => ({
          ldap: { "ppolicy.ldif": overlayLdif("ppolicy", "olcPPolicyConfig", `olcPPolicyDefault: cn=default,ou=policies,${SUFFIX}\n`) },
          pc: {
            "policy.ldif":
              `dn: ou=policies,${SUFFIX}\nchangetype: add\nobjectClass: organizationalUnit\nou: policies\n\n` +
              `dn: cn=default,ou=policies,${SUFFIX}\nchangetype: add\nobjectClass: pwdPolicy\nobjectClass: device\ncn: default\npwdAttribute: userPassword\npwdMaxFailure: 3\npwdLockout: TRUE\npwdLockoutDuration: 300\npwdFailureCountInterval: 600\n`,
            "unlock-hana.ldif": `dn: ${DN("hana")}\nchangetype: modify\ndelete: pwdAccountLockedTime\n`,
          },
        }),
      }),
    steps: [
      {
        say: "ハナが、パスワードを **3回つづけてまちがえた** とします。設定なしだと、サーバーはどうするかな？",
        host: "pc",
        cmd: `ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai`,
        phase: "off",
        ok: (r) => r.ops.filter((o) => o.kind === "bind" && o.code === 49).length >= 3,
        learn: "3回とも 49 ですが、サーバーは **数えていません**。これでは何百回・何千回でも試せてしまいます。",
        show: ["trace"],
      },
      {
        say: "パスワードのルールを使う **ppolicy** overlay を入れよう（モジュールを読みこんでから、overlay を足します）。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f ppolicy.ldif",
        phase: "apply",
        ok,
        learn: "ppolicy overlay を入れました。**olcPPolicyDefault** が「ルールが書いてあるエントリ（cn=default）」を指しています。",
        show: ["config"],
      },
      {
        say: "ルールのエントリを、名簿に足そう。ルールは cn=config ではなく、名簿の中に置くので、管理者（cn=admin）で足します。",
        host: "pc",
        cmd: `ldapadd ${AS_ADMIN} -f policy.ldif`,
        phase: "apply",
        ok,
        learn: "**pwdMaxFailure: 3**（3回まで）・**pwdLockout: TRUE**（ロックする）・**pwdLockoutDuration: 300**（300秒）というルールを置きました。",
      },
      {
        say: "では、またハナが3回まちがえたら？",
        host: "pc",
        cmd: `ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai`,
        phase: "on",
        ok: (r) => r.ops.some((o) => o.kind === "bind" && o.lockedNow),
        learn: "3回目で、サーバーがハナのアカウントに **ロック**（pwdAccountLockedTime）をかけました。ppolicy が、まちがえた回数を数えていたのです。",
        show: ["trace", "tree"],
      },
      {
        say: "ロック中に、**正しい** パスワードでログインすると…？ -e ppolicy をつけると、理由も教えてもらえます。",
        host: "pc",
        cmd: `ldapwhoami -x -e ppolicy -D "${DN("hana")}" -w '${PW.hana}'`,
        phase: "on",
        ok: (r) => r.exit === 49,
        learn: "正しいのに 49。理由は **Account locked**（ロック中）。ロックは当てずっぽうを止めてくれますが、本人も入れなくなります。だから「いつ外れるか」も決めておきます。",
        show: ["trace"],
      },
      {
        say: "**pwdLockoutDuration** は 300秒。5分たつのを待ってから（この部屋では一瞬です）、もう一度ログインしよう。",
        host: "pc",
        cmd: `sleep 300 && ldapwhoami -x -e ppolicy -D "${DN("hana")}" -w '${PW.hana}'`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "dn:uid=hana"),
        learn: "ロックが自動で外れて、入れました。急ぐときは、管理者がロック（pwdAccountLockedTime）を消して外すこともできます（自由に試すで、unlock-hana.ldif を使えます）。",
        show: ["trace"],
        why: "ppolicy:duration",
      },
    ],
    probe: {
      host: "pc",
      cmd: `ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -D "${DN("hana")}" -w machigai ; ldapwhoami -x -e ppolicy -D "${DN("hana")}" -w '${PW.hana}'`,
      note: "3回まちがえたあとに、正しいパスワードを打ちます。",
      label: (r) => (r.ops.some((o) => o.kind === "bind" && o.lockedNow) ? "3回目でロック → 正しいパスワードでも入れない" : "数えない → 正しいパスワードで入れた"),
    },
    compare: [
      { head: "3回まちがえる", off: "数えない（何回でも試せる）", on: "3回目でロック" },
      { head: "そのあと正しいパスワード", off: "入れる", on: "49（Account locked）" },
      { head: "ロックが外れるのは", off: "—", on: "300秒後（pwdLockoutDuration）か、管理者が外す" },
    ],
    tries: [
      { label: "まちがえる", host: "pc", cmd: `ldapwhoami -x -D "${DN("hana")}" -w machigai` },
      { label: "正しくログイン", host: "pc", cmd: `ldapwhoami -x -e ppolicy -D "${DN("hana")}" -w '${PW.hana}'` },
      { label: "5分待つ", host: "pc", cmd: "sleep 300" },
      { label: "管理者がロックを外す", host: "pc", cmd: `ldapmodify ${AS_ADMIN} -f unlock-hana.ldif` },
      { label: "ロックの記録を見る", host: "pc", cmd: `ldapsearch ${AS_ADMIN} -LLL "(uid=hana)" pwdFailureTime pwdAccountLockedTime` },
    ],
    summary: ["設定なしだと、サーバーはまちがいを数えない", "ppolicy overlay＋pwdMaxFailure・pwdLockout で、まちがえすぎたらロック", "ロック中は、正しいパスワードでも 49", "pwdLockoutDuration で自動で外れる（管理者が外すこともできる）"],
    quiz: {
      q: "ロック中に、正しいパスワードでログインすると？",
      choices: ["ログインできる", "49 で断られる（Account locked）", "ロックが外れる"],
      answer: 1,
      explain: "ロック中は、パスワードが正しくても 49 です。pwdLockoutDuration がすぎるか、管理者が外すまで入れません。",
    },
  },

  /* 7. memberOf ---------------------------------------------------------- */
  {
    id: "memberof",
    no: 7,
    chapter: 3,
    icon: "worker",
    color: "#ffa45c",
    title: "この人は、どのグループ？",
    sub: "memberof overlay — 人のほうからグループを知る",
    intro:
      "グループ（groupOfNames）は「だれが入っているか（**member**）」を持っています。でも、人のエントリには何も書いていないので、人のほうからは「どのグループか」が分かりません。**memberof** overlay を入れると、グループが変わったときに、人のエントリへ **memberOf** を自動で書いてくれます。",
    analogy: "部活の名簿に名前を書くと、生徒手帳にも「所属：○○部」のハンコが押される。",
    knob: { ref: "memberof", title: "memberof overlay", where: "olcDatabase={1}mdb,cn=config", off: "人のほうには何も書かない", on: "グループが変わると memberOf を書く", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "memberof") },
    build: (seed) =>
      scenario(seed, {
        files: () => ({
          ldap: { "memberof.ldif": overlayLdif("memberof", "olcMemberOf") },
          pc: {
            "join.ldif": `dn: cn=admin,ou=groups,${SUFFIX}\nchangetype: modify\nadd: member\nmember: ${DN("momo")}\n`,
            "readd-pochi.ldif": `dn: cn=admin,ou=groups,${SUFFIX}\nchangetype: modify\ndelete: member\nmember: ${DN("pochi")}\n-\nadd: member\nmember: ${DN("pochi")}\n`,
          },
        }),
      }),
    steps: [
      {
        say: "pochi は admin グループに入っています。人のエントリから **memberOf** をきいてみよう（memberOf は名前を書いて頼まないと出ない属性です）。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" memberOf`,
        phase: "off",
        ok: (r) => ok(r) && !has(r, "memberOf:"),
        learn: "dn だけで、**memberOf はありません**。グループの情報は、グループのほう（cn=admin の member）にしか書いていないのです。人のグループを知るには、グループを全部さがすことになります。",
        show: ["trace"],
      },
      {
        say: "memberof overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f memberof.ldif",
        phase: "apply",
        ok,
        learn: "memberof overlay を入れました。これから、グループの member が変わったときに、その人のエントリへ memberOf を書きます。",
        show: ["config"],
      },
      {
        say: "モモを、admin グループに入れよう。",
        host: "pc",
        cmd: `ldapmodify ${AS_ADMIN} -f join.ldif`,
        phase: "on",
        ok,
        learn: "グループに member を足しました。「サーバーの中」を見ると、overlay がモモのエントリにも書いたのが分かります。",
        show: ["trace"],
      },
      {
        say: "モモの memberOf を見てみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=momo)" memberOf`,
        phase: "on",
        ok: (r) => ok(r) && has(r, "memberOf:"),
        learn: "**memberOf: cn=admin,ou=groups,…** が自動でつきました！ これで「人 → グループ」がすぐ分かります（SSSD などのログインの条件にも使えます）。",
        show: ["tree"],
      },
      {
        say: "落とし穴：前から admin に入っていた pochi は、どうなっているかな？",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" memberOf`,
        phase: "trap",
        ok: (r) => ok(r) && !has(r, "memberOf:"),
        learn: "pochi には **まだついていません**。overlay が書くのは、入れた **あとに** グループが変わった人だけ。前からのメンバーには、自動ではつかないのです。",
        show: ["trace", "tree"],
      },
      {
        say: "pochi を、admin グループに入れなおそう（外して、すぐ足す）。そのあと memberOf を見ます。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(uid=pochi)" memberOf`,
        pre: { host: "pc", cmd: `ldapmodify ${AS_ADMIN} -f readd-pochi.ldif` },
        phase: "on",
        ok: (r) => ok(r) && has(r, "memberOf:"),
        learn: "入れなおしたら、pochi にも memberOf がつきました。本物でも、overlay をあとから入れたら、一度データを入れなおします。",
        show: ["tree"],
      },
    ],
    probe: {
      host: "pc",
      cmd: `ldapmodify ${AS_ADMIN} -f join.ldif && ldapsearch -x -LLL "(uid=momo)" memberOf`,
      note: "モモをグループに入れてから、モモの memberOf を見ます。",
      label: (r) => (has(r, "memberOf:") ? "モモに memberOf が自動でついた" : "モモには何もつかない"),
    },
    compare: [
      { head: "グループに入れた人の memberOf", off: "つかない", on: "自動でつく" },
      { head: "グループの member", off: "ある", on: "ある（変わらない）" },
      { head: "overlay を入れる前からの人", off: "—", on: "入れなおすまで、つかない" },
    ],
    tries: [
      { label: "モモをグループへ", host: "pc", cmd: `ldapmodify ${AS_ADMIN} -f join.ldif` },
      { label: "モモの memberOf", host: "pc", cmd: `ldapsearch -x -LLL "(uid=momo)" memberOf` },
      { label: "pochi の memberOf", host: "pc", cmd: `ldapsearch -x -LLL "(uid=pochi)" memberOf` },
      { label: "memberOf でさがす", host: "pc", cmd: `ldapsearch -x -LLL "(memberOf=cn=admin,ou=groups,${SUFFIX})" uid` },
      { label: "グループ側の member", host: "pc", cmd: `ldapsearch -x -LLL "(cn=admin)" member` },
    ],
    summary: ["ふつうは「グループ → member」しか書いていない", "memberof overlay で、人に memberOf が自動でつく", "overlay は、入れたあとの変更だけを書く（前からの人は入れなおす）", "memberOf は名前を書いて頼んだときだけ出る"],
    quiz: {
      q: "memberof overlay を入れたあと、前からのメンバーの memberOf は？",
      choices: ["自動でつく", "グループを変える（入れなおす）までつかない", "消える"],
      answer: 1,
      explain: "overlay は、グループが変わったときに書くしくみです。入れる前からのメンバーには、入れなおすまでつきません。",
    },
  },

  /* 8. refint ------------------------------------------------------------ */
  {
    id: "refint",
    no: 8,
    chapter: 3,
    icon: "replica",
    color: "#d3c2ff",
    title: "消した人が、グループに残る？",
    sub: "refint overlay — 消した人への参照を片づける",
    intro:
      "グループの **member** には、人の DN（住所）が書いてあります。人を名簿から消しても、グループの member には **その DN が残ったまま** です（もういない人を指す、迷子の参照）。**refint**（参照の整合性）overlay を入れると、人を消したときに、member からも自動で消してくれます。",
    analogy: "退部した人を名簿から消しても、部員一覧に名前が残っていたら困る。いっしょに消してくれる係。",
    knob: { ref: "refint", title: "refint overlay（olcRefintAttribute: member）", where: "olcDatabase={1}mdb,cn=config", off: "member に残る", on: "消した人を member からも消す", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "refint") },
    build: (seed) =>
      scenario(seed, {
        adminMembers: ["pochi", "hana", "momo"],
        files: () => ({ ldap: { "refint.ldif": overlayLdif("refint", "olcRefintConfig", `olcRefintAttribute: member\nolcRefintNothing: ${ADMIN}\n`) } }),
      }),
    steps: [
      {
        say: "admin グループには pochi・hana・momo がいます。お店をやめた **hana を、名簿から消そう**。",
        host: "pc",
        cmd: `ldapdelete ${AS_ADMIN} "${DN("hana")}"`,
        phase: "off",
        ok,
        learn: "hana のエントリを消しました（ldapdelete はうまくいくと何も出しません）。グループのほうは、どうなったかな？",
        show: ["trace"],
      },
      {
        say: "admin グループの member を見てみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(cn=admin)" member`,
        phase: "off",
        ok: (r) => ok(r) && has(r, DN("hana")),
        learn: "消したはずの **uid=hana** が、member に残っています。もしあとで同じ uid=hana の新しい人が入ったら、その人が **前の hana の権限（admin）をそのまま引きつぎます**。",
        show: ["tree"],
      },
      {
        say: "refint overlay を入れよう。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f refint.ldif",
        phase: "apply",
        ok,
        learn: "refint overlay を入れました（olcRefintAttribute: member）。olcRefintNothing は、グループが空になってしまうときに入れておく DN です（groupOfNames は member が1つは必要）。",
        show: ["config"],
      },
      {
        say: "こんどは **momo を消してみよう**。",
        host: "pc",
        cmd: `ldapdelete ${AS_ADMIN} "${DN("momo")}"`,
        phase: "on",
        ok: (r) => ok(r) && (r.ops.find((o) => o.kind === "delete")?.touched?.length ?? 0) > 0,
        learn: "momo を消したら、refint が **admin の member からも momo を消しました**（「サーバーの中」に出ています）。",
        show: ["trace"],
      },
      {
        say: "もう一度、admin グループの member を見よう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(cn=admin)" member`,
        phase: "on",
        ok: (r) => ok(r) && !has(r, DN("momo")) && has(r, DN("pochi")),
        learn: "momo は消えて、迷子の参照はできませんでした。でも、設定する前に消した hana は残ったまま。refint が片づけるのは、入れたあとの削除だけです（前のぶんは手で直します）。",
        show: ["tree"],
      },
    ],
    probe: {
      host: "pc",
      cmd: `ldapdelete ${AS_ADMIN} "${DN("momo")}" && ldapsearch -x -LLL "(cn=admin)" member`,
      note: "momo を消してから、admin グループの member を見ます。",
      label: (r) => (has(r, DN("momo")) ? "消した momo が member に残った（迷子）" : "member からも momo が消えた"),
    },
    compare: [
      { head: "消した人の DN", off: "member に残る（迷子）", on: "member からも消える" },
      { head: "同じ DN の新しい人", off: "前の人の権限を引きつぐ", on: "引きつがない" },
      { head: "効くのは", off: "—", on: "overlay を入れたあとの削除" },
    ],
    tries: [
      { label: "momo を消す", host: "pc", cmd: `ldapdelete ${AS_ADMIN} "${DN("momo")}"` },
      { label: "admin の member", host: "pc", cmd: `ldapsearch -x -LLL "(cn=admin)" member` },
      { label: "hana が入っているグループ", host: "pc", cmd: `ldapsearch -x -LLL "(member=${DN("hana")})" cn` },
      { label: "グループを消そうとする", host: "pc", cmd: `ldapdelete ${AS_ADMIN} "ou=groups,${SUFFIX}"` },
    ],
    summary: ["グループの member には、人の DN が書いてある", "人を消しても、member には DN が残る（迷子の参照）", "同じ DN の新しい人が、前の人の権限を引きつぐおそれ", "refint overlay が、消した人の DN を member からも消す"],
    quiz: {
      q: "refint がないとき、人を名簿から消すと、グループの member は？",
      choices: ["その人の DN が残る", "グループも消える", "自動で直る"],
      answer: 0,
      explain: "member は DN（住所）を書いてあるだけなので、人を消しても残ります。refint overlay を入れると、いっしょに消してくれます。",
    },
  },

  /* 9. unique ------------------------------------------------------------ */
  {
    id: "unique",
    no: 9,
    chapter: 3,
    icon: "auto",
    color: "#4ade80",
    title: "番号がかぶると、区別できない",
    sub: "unique overlay — uidNumber のかぶりを止める",
    intro:
      "Linux は、人を名前ではなく **番号（uidNumber）** で見分けます。もし2人が同じ uidNumber を持つと、Linux からは **同じ人** に見えてしまいます。LDAP は、何もしないと番号のかぶりを気にしません。**unique** overlay で、かぶりを入口で止めましょう。",
    analogy: "出席番号が同じ人が2人いたら、先生は出席簿でも成績でも、2人を区別できない。",
    knob: { ref: "unique", title: "unique overlay（uidNumber）", where: "olcDatabase={1}mdb,cn=config", off: "かぶっても入る", on: "同じ uidNumber を断る", isOn: (lab) => lab.server.cfg.overlays.some((o) => o.kind === "unique") },
    build: (seed) =>
      scenario(seed, {
        reader: true,
        fs: {
          "/home": { uid: 0, gid: 0, mode: 0o755, dir: true },
          "/home/pochi": { uid: 10001, gid: 10000, mode: 0o700, dir: true },
          "/home/pochi/uriage.txt": { uid: 10001, gid: 10000, mode: 0o600, content: "10月の売上：1,250,000円（店長 pochi だけが見られるファイル）", size: 74, mtime: "Oct 12 20:10" },
        },
        cast: { ...PW, shiro: "Shiro$2026", tora: "Tora%2026" },
        files: (h) => ({
          ldap: { "unique.ldif": overlayLdif("unique", "olcUniqueConfig", `olcUniqueURI: ldap:///${SUFFIX}?uidNumber?sub\n`) },
          pc: { "shiro.ldif": newUser(h, "shiro", "シロ", 10001, "Shiro$2026"), "tora.ldif": newUser(h, "tora", "トラ", 10001, "Tora%2026") },
        }),
      }),
    steps: [
      {
        say: "新人シロを名簿に足します。でも、店長 pochi の LDIF をコピーして作ったので、**uidNumber が 10001（pochi と同じ）** のままです。",
        host: "pc",
        cmd: `ldapadd ${AS_ADMIN} -f shiro.ldif`,
        phase: "off",
        ok,
        learn: "そのまま入ってしまいました。サーバーは、番号のかぶりを気にしません。",
      },
      {
        say: "シロで、お店のサーバー（shop）にログインして「わたしはだれ？」（whoami）と聞いてみよう。",
        host: "pc",
        cmd: "ssh shiro@shop whoami",
        phase: "off",
        ok: (r) => ok(r) && has(r, "pochi"),
        learn: "シロでログインしたのに、答えは **pochi**！ Linux は番号 10001 で人を見分けるので、名簿で 10001 をさがすと、先に入っていた pochi が見つかるのです。",
        show: ["trace"],
      },
      {
        say: "シロで、店長しか見られないはずのファイル（/home/pochi/uriage.txt）を開いてみよう。",
        host: "pc",
        cmd: "ssh shiro@shop cat /home/pochi/uriage.txt",
        phase: "off",
        ok: (r) => ok(r) && has(r, "売上"),
        learn: "開けてしまいました。ファイルの持ち主は番号 10001。シロも 10001 なので、Linux には「本人のファイル」に見えるのです。番号のかぶりは、うっかりでも、こんなことが起きます。",
        show: ["trace"],
      },
      {
        say: "番号のかぶりを止める **unique** overlay を入れよう（olcUniqueURI で「名簿の中で uidNumber をかぶらせない」と決めます）。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f unique.ldif",
        phase: "apply",
        ok,
        learn: "unique overlay を入れました。olcUniqueURI の「?uidNumber?sub」が、「名簿の下全部で、uidNumber は1つずつ」という意味です。",
        show: ["config"],
      },
      {
        say: "もう1人の新人トラも、同じ uidNumber 10001 で足そうとしてみよう。",
        host: "pc",
        cmd: `ldapadd ${AS_ADMIN} -f tora.ldif`,
        phase: "on",
        ok: (r) => r.exit === 19,
        learn: "**19**（決まりに合わない）で断られました。「10001 は、もう使われている」と unique が止めたのです。番号を直せば足せます。すでにかぶってしまったシロは、手で番号を直します。",
        show: ["trace"],
      },
    ],
    probe: { host: "pc", cmd: `ldapadd ${AS_ADMIN} -f tora.ldif`, label: (r) => (ok(r) ? "pochi と同じ番号 10001 のトラが入った" : "番号のかぶりを、入口で止めた") },
    compare: [
      { head: "同じ uidNumber で足す", off: "入ってしまう", on: "19 で止める" },
      { head: "Linux から見ると", off: "2人が同じ人に見える", on: "1人ずつ区別できる" },
      { head: "すでにかぶっている人", off: "—", on: "止めない（手で直す）" },
    ],
    tries: [
      { label: "シロを足す", host: "pc", cmd: `ldapadd ${AS_ADMIN} -f shiro.ldif` },
      { label: "シロで whoami", host: "pc", cmd: "ssh shiro@shop whoami" },
      { label: "シロでファイルを開く", host: "pc", cmd: "ssh shiro@shop cat /home/pochi/uriage.txt" },
      { label: "番号 10001 の人", host: "pc", cmd: `ldapsearch -x -LLL "(uidNumber=10001)" uid` },
      { label: "トラを足す", host: "pc", cmd: `ldapadd ${AS_ADMIN} -f tora.ldif` },
    ],
    summary: ["Linux は人を uidNumber（番号）で見分ける", "番号がかぶると、別の人なのに同じ人に見える", "LDAP は何もしないと、かぶりを止めない", "unique overlay で、入口で止める（19）"],
    quiz: {
      q: "2人が同じ uidNumber を持つと、Linux では？",
      choices: ["2人が同じ人として扱われる", "新しい人が使えなくなる", "番号が自動で変わる"],
      answer: 0,
      explain: "Linux は番号で人を見分けるので、同じ番号の2人は区別できません。ファイルの持ち主もごちゃまぜになります。",
    },
  },

  /* 10. インデックス ------------------------------------------------------ */
  {
    id: "index",
    no: 10,
    chapter: 4,
    icon: "cache",
    color: "#b6f05a",
    title: "さがすのが遅い",
    sub: "olcDbIndex — 全部見るか、さくいんで一発か",
    intro:
      "名簿が大きくなると、さがしものに時間がかかります。**インデックス**（olcDbIndex）がない属性でさがすと、サーバーは名簿を **1件ずつ全部** 見ます。会員が2000人いる名簿で、ためしてみよう。",
    analogy: "本のさくいん。ないと、1ページ目から全部めくってさがすことになる。",
    knob: { ref: "index:mail", title: "olcDbIndex: mail eq", where: "olcDatabase={1}mdb,cn=config", off: "mail のさくいんなし", on: "mail のさくいんあり", isOn: (lab) => Boolean(lab.server.cfg.index.get("mail")?.has("eq")) },
    build: (seed) =>
      scenario(seed, {
        bulk: 2000,
        files: () => ({
          ldap: {
            "index.ldif": mdb("add: olcDbIndex\nolcDbIndex: mail eq\n"),
            "index-sub.ldif": mdb("delete: olcDbIndex\nolcDbIndex: mail eq\n-\nadd: olcDbIndex\nolcDbIndex: mail eq,sub\n"),
          },
        }),
      }),
    steps: [
      {
        say: "メールアドレスで、pochi をさがそう。「サーバーの中」で、何件見たかが分かります。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn`,
        phase: "off",
        ok: (r) => ok(r) && scanned(r) > 1000,
        learn: (r) => `見つかりましたが、サーバーは名簿を **${num(scanned(r))}件、1件ずつ** 見ました。mail にさくいんがないからです（ログに「mdb_equality_candidates: (mail) not indexed」）。`,
        show: ["trace", "logs"],
      },
      {
        say: "mail のさくいん（**olcDbIndex: mail eq**）を作ろう。eq は「ぴったり同じ」でさがすためのさくいんです。",
        host: "ldap",
        cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f index.ldif",
        phase: "apply",
        ok,
        learn: "mail eq のさくいんを作りました。cn=config で足すと、さくいんは自動で作りなおされます。",
        show: ["config"],
      },
      {
        say: "もう一度、同じメールアドレスでさがそう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn`,
        phase: "on",
        ok: (r) => ok(r) && indexed(r),
        learn: (r) => `さくいんから、候補を **${num(scanned(r))}件** にしぼれました。全部を見なくてよいので、名簿が大きくなるほど差がひらきます。`,
        show: ["trace"],
      },
      {
        say: "落とし穴：こんどは「pochi で始まる」メール（**(mail=pochi*)**）でさがしてみよう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi*)" dn`,
        phase: "trap",
        ok: (r) => ok(r) && !indexed(r) && scanned(r) > 1000,
        learn: (r) => `また **${num(scanned(r))}件** 全部を見ました！ eq のさくいんは「ぴったり同じ」にしか使えません。* を使う「部分一致」には、**sub** のさくいんが要ります（ログに mdb_substring_candidates … not indexed）。`,
        show: ["trace", "logs"],
      },
      {
        say: "mail のさくいんを **eq,sub**（ぴったり＋部分一致）にしてから、もう一度さがそう。",
        host: "pc",
        cmd: `ldapsearch -x -LLL "(mail=pochi*)" dn`,
        pre: { host: "ldap", cmd: "ldapmodify -Y EXTERNAL -H ldapi:/// -f index-sub.ldif" },
        phase: "on",
        ok: (r) => ok(r) && indexed(r),
        learn: "こんどはさくいんで一発です。さくいんは「どの属性を」だけでなく「どうさがすか」（eq・sub・pres）も合わせて作ります。",
        show: ["trace", "config"],
      },
    ],
    probe: { host: "pc", cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn`, label: (r) => `見たエントリ：${num(scanned(r))}件` },
    compare: [
      { head: "(mail=…) でさがす", off: "全部（2000件以上）を見る", on: "さくいんで候補だけ" },
      { head: "(mail=pochi*) でさがす", off: "全部を見る", on: "eq だけでは全部。sub も要る" },
      { head: "よくさくいんにする属性", off: "—", on: "uid・mail・objectClass・member など" },
    ],
    tries: [
      { label: "mail でさがす", host: "pc", cmd: `ldapsearch -x -LLL "(mail=pochi@wanko.shop)" dn` },
      { label: "pochi で始まる", host: "pc", cmd: `ldapsearch -x -LLL "(mail=pochi*)" dn` },
      { label: "uid でさがす（もとからさくいん）", host: "pc", cmd: `ldapsearch -x -LLL "(uid=member150)" mail` },
      { label: "slapd のログ", host: "ldap", cmd: "journalctl -u slapd -n 8" },
      { label: "いまの olcDbIndex", host: "ldap", cmd: `ldapsearch -Y EXTERNAL -H ldapi:/// -LLL -o ldif-wrap=no -b cn=config "(olcDatabase={1}mdb)" olcDbIndex` },
    ],
    summary: ["さくいんのない属性でさがすと、名簿を全部1件ずつ見る", "olcDbIndex eq は「ぴったり」、sub は「部分一致（*）」", "よくさがす属性に、さがし方に合ったさくいんを"],
    quiz: {
      q: "(mail=pochi*) を速くしたい。どのさくいん？",
      choices: ["mail eq", "mail sub", "uid eq"],
      answer: 1,
      explain: "* を使う部分一致には sub のさくいんが要ります。eq は「ぴったり同じ」のときにしか使えません。",
    },
  },

  /* 11. SSSD のアクセス制御 ------------------------------------------------ */
  {
    id: "sssd",
    no: 11,
    chapter: 4,
    icon: "region",
    color: "#e879f9",
    title: "名簿にいれば、だれでもログイン？",
    sub: "SSSD の ldap_access_filter — サーバーに入れる人をしぼる",
    intro:
      "お店のサーバー（shop）は、**SSSD** というしくみで LDAP の名簿を見て、ログインさせます。何も設定しないと、**名簿にいる人は全員** ログインできます。スタッフのモモも、売上のデータがあるサーバーに入れてしまう。**ldap_access_filter** で、入れる人をしぼりましょう。",
    analogy: "社員証があれば、だれでもサーバー室に入れてしまう状態。本当は、担当の人だけでいい。",
    knob: { ref: "sssd:access", title: "ldap_access_filter（お店のサーバーの sssd.conf）", where: "/etc/sssd/sssd.conf（shop）", off: "permit（名簿の全員）", on: "店長だけ", isOn: (lab) => lab.sssd.running.access === "ldap" && Boolean(lab.sssd.running.filter) },
    build: (seed) => scenario(seed, { reader: true }),
    steps: [
      {
        say: "スタッフのモモで、お店のサーバーにログインして whoami を打ってみよう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        phase: "off",
        ok: (r) => ok(r) && has(r, "momo"),
        learn: "入れました。SSSD は access_provider を書いていないと **permit**（名簿にいれば、だれでもOK）です。",
        show: ["trace"],
      },
      {
        say: "お店のサーバーの **sssd.conf** に、「店長（title=店長）だけ入れる」ルールを書きました。書いただけで効くか、もう一度モモで試そう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        before: (lab) => {
          lab.sssd.file.access = "ldap";
          lab.sssd.file.filter = "(title=店長)";
        },
        beforeNote: "お店のサーバーの /etc/sssd/sssd.conf を書きかえた：access_provider = ldap ／ ldap_access_filter = (title=店長)",
        phase: "apply",
        prep: false,
        ok: (r) => ok(r) && has(r, "momo"),
        learn: "まだ入れてしまいます。ファイルを書きかえても、**動いている SSSD は、読みこんだときの設定のまま** だからです。",
        show: ["trace", "config"],
        why: "sssd:running",
      },
      {
        say: "お店のサーバーで、SSSD を再起動して、新しい sssd.conf を読みこもう。",
        host: "shop",
        cmd: "systemctl restart sssd",
        phase: "apply",
        ok,
        learn: "SSSD を再起動しました（systemctl はうまくいくと何も出しません）。ここから新しい設定で動きます。",
        show: ["config", "logs"],
      },
      {
        say: "もう一度、モモでログインしよう。",
        host: "pc",
        cmd: "ssh momo@shop whoami",
        phase: "on",
        ok: (r) => r.exit !== 0 && r.ops.find((o) => o.kind === "ssh")?.stage === "access",
        learn: "こんどは入れません。パスワードは合っているのに、SSSD が名簿で (&(uid=momo)(title=店長)) をさがして、見つからなかったからです（/var/log/secure に Access denied）。",
        show: ["trace", "logs"],
      },
      {
        say: "店長の pochi なら、入れるはず。",
        host: "pc",
        cmd: "ssh pochi@shop whoami",
        phase: "on",
        ok: (r) => ok(r) && has(r, "pochi"),
        learn: "pochi は入れました。「名簿の全員」から「店長だけ」に、サーバーに入れる人をしぼれました。",
        show: ["trace"],
      },
    ],
    probe: { host: "pc", cmd: "ssh momo@shop whoami", label: (r) => (ok(r) ? "スタッフのモモも入れた" : "モモは入れない（店長だけ）") },
    compare: [
      { head: "スタッフ（モモ）がログイン", off: "入れる", on: "入れない（Connection closed）" },
      { head: "店長（pochi）がログイン", off: "入れる", on: "入れる" },
      { head: "設定を効かせるには", off: "—", on: "sssd.conf を書いて systemctl restart sssd" },
    ],
    tries: [
      { label: "モモでログイン", host: "pc", cmd: "ssh momo@shop whoami" },
      { label: "pochi でログイン", host: "pc", cmd: "ssh pochi@shop whoami" },
      { label: "sssd.conf を見る", host: "shop", cmd: "cat /etc/sssd/sssd.conf" },
      { label: "SSSD を再起動", host: "shop", cmd: "systemctl restart sssd" },
      { label: "ログイン記録", host: "shop", cmd: "tail -n 6 /var/log/secure" },
      { label: "モモは Linux のユーザー？", host: "shop", cmd: "getent passwd momo" },
    ],
    summary: ["SSSD は、何もしないと名簿の全員をログインさせる（permit）", "ldap_access_filter で、入れる人を名簿の条件でしぼる", "sssd.conf は書いただけでは効かない。restart で読みこむ"],
    quiz: {
      q: "sssd.conf を書きかえたのに、ログインの決まりが変わらない。なぜ？",
      choices: ["LDAP サーバーを再起動していない", "SSSD を再起動していない（まだ読みこんでいない）", "パスワードがまちがっている"],
      answer: 1,
      explain: "動いている SSSD は、読みこんだときの設定のままです。systemctl restart sssd で、新しい sssd.conf を読みこみます。",
    },
  },
];

/* ------------------------------------------------------------ 補助 */

export const cardById = (id: string) => CARDS.find((c) => c.id === id);
/** 一覧・見出しに出す番号 */
export const cardLabel = (c: StudyCard) => (c.no ? `設定 ${c.no}` : "はじめに");
/** 文の中の **ことば** を分ける */
export const splitStudy = (text: string) => text.split("**");

/** 設定を入れるために動かしたこと（コマンド、または設定ファイルの書きかえ） */
export type PrepRun = { host: HostId; cmd: string; run: Run } | { note: string };

/**
 * まっさらな名簿を作る。on なら、設定を入れるステップ（apply）だけを順に動かして「設定あり」にする
 * （prep: false のステップは、設定ファイルの書きかえ（before）だけ）。見くらべる・自由に試すで使う。
 * runs … そのとき動かしたこと（ターミナルに出す）
 */
export function prepareLab(card: StudyCard, on: boolean, seed = SEED_BASE + card.no): { lab: LdapLab; runs: PrepRun[] } {
  const lab = card.build(seed);
  const runs: PrepRun[] = [];
  if (on)
    for (const st of card.steps) {
      if (st.phase !== "apply") continue;
      if (st.before) {
        st.before(lab);
        if (st.beforeNote) runs.push({ note: st.beforeNote });
      }
      if (st.pre) runs.push({ host: st.pre.host, cmd: st.pre.cmd, run: lab.run(st.pre.host, st.pre.cmd) });
      if (st.prep !== false) runs.push({ host: st.host, cmd: st.cmd, run: lab.run(st.host, st.cmd) });
    }
  return { lab, runs };
}
