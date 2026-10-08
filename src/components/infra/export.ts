/**
 * ラボで組み立てた構成を、本物のインフラの設定ファイルにする（学習用の見本）。
 * - docker-compose.yml … パソコンの中に、同じ構成を作る（クラウドにしかないパーツはコメントで説明）
 * - nginx.conf … ロードバランサーの振り分け先（docker-compose から使う）
 * - main.tf … AWS（クラウド）に同じ構成を作る Terraform
 * つなぎ方（リンク）も反映する：ロードバランサーが振り分けるサーバー、サーバーがつながる DB・キャッシュ・キュー など。
 * 本物の値が要るところ（OS イメージ・ネットワーク・パスワード）は variable にしてある。
 */
import type { Design } from "./design";
import { USERS } from "./layout";
import { PARTS, kindOf, slotLabel, type NodeId, type PartKind } from "./model";

export type ExportFile = { name: string; lang: "yaml" | "nginx" | "hcl"; body: string };
/** どのパーツが、本物では何になるか */
export type ExportRow = { part: string; local: string; aws: string };

const APP_TYPE = ["t3.small", "t3.medium", "t3.large"];
const DB_TYPE = ["db.t3.micro", "db.t3.medium"];
const APP_LIMIT = [
  { cpus: "1", memory: "1g" },
  { cpus: "2", memory: "2g" },
  { cpus: "4", memory: "4g" },
];
/** ゲームの TTL（15秒・3秒）を、本物でよく使う長さに */
const REAL_TTL = [300, 60];

type View = {
  ids: NodeId[];
  of: (k: PartKind) => NodeId[];
  one: (k: PartKind) => NodeId | undefined;
  from: (a: string, k?: PartKind) => NodeId[];
  size: (id: NodeId) => number;
};

function view(d: Design): View {
  const ids = d.placements.map((p) => p.slot);
  return {
    ids,
    of: (k) => ids.filter((s) => kindOf(s) === k),
    one: (k) => ids.find((s) => kindOf(s) === k),
    from: (a, k) => d.links.filter((l) => l.a === a && (!k || kindOf(l.b) === k)).map((l) => l.b),
    size: (id) => d.placements.find((p) => p.slot === id)?.size ?? 0,
  };
}

/** docker-compose / Terraform での名前（予備DB は db-replica） */
const svc = (id: NodeId) => (kindOf(id) === "replica" ? id.replace("replica", "db-replica") : id);
const tf = (id: NodeId) => svc(id).replace(/-/g, "_");

/* ------------------------------------------------------------ docker-compose */

function compose(v: View): string {
  const L: string[] = [];
  const w = (s = "") => L.push(s);
  const db = v.one("db");
  const replicas = v.of("replica");
  const lb = v.one("lb");
  w("# わんこ商店の構成（インフラ アプリのラボで設計）");
  w("# `docker compose up` で、パソコンの中に同じ構成を作れます（学習用の見本）");
  w("# app のプログラムは、このファイルと同じフォルダの Dockerfile から作る想定です");
  const cloud = v.ids.filter((s) => ["dns", "cdn", "waf", "region", "auto"].includes(kindOf(s)));
  if (cloud.length) w(`# ${cloud.map(slotLabel).join("・")} はクラウドのサービスなので、main.tf（Terraform）のほうに書いてあります`);
  w("services:");
  if (lb) {
    const ups = v.from(lb, "app");
    w(`  ${lb}: # ロードバランサー（nginx.conf で振り分け先を決める）`);
    w("    image: nginx:1.27");
    w("    ports:");
    w('      - "8080:80"');
    w("    volumes:");
    w("      - ./nginx.conf:/etc/nginx/nginx.conf:ro");
    if (ups.length) w(`    depends_on: [${ups.join(", ")}]`);
  }
  const entryApps = v.from(USERS, "app").concat(v.one("waf") ? v.from(v.one("waf")!, "app") : []);
  v.of("app").forEach((id) => {
    w(`  ${id}: # ${slotLabel(id)}（${PARTS.app.sizes[v.size(id)]!.label} サイズ）`);
    w("    build: .");
    if (!lb && entryApps[0] === id) {
      w("    ports:");
      w('      - "8080:3000"');
    }
    env(w, v, id);
    const lim = APP_LIMIT[v.size(id)]!;
    w("    deploy:");
    w("      resources:");
    w(`        limits: { cpus: "${lim.cpus}", memory: ${lim.memory} }`);
    deps(w, v, id);
  });
  v.of("worker").forEach((id) => {
    w(`  ${id}: # ${slotLabel(id)}（キューの仕事を裏で片づける）`);
    w("    build: .");
    w("    command: npm run worker");
    env(w, v, id);
    deps(w, v, id);
  });
  const cache = v.one("cache");
  if (cache) {
    w(`  ${cache}: # キャッシュ`);
    w("    image: redis:7");
  }
  if (db) {
    w(`  ${db}: # データベース（本番）`);
    w("    image: postgres:16");
    w("    environment:");
    w("      POSTGRES_USER: shop");
    w("      POSTGRES_PASSWORD: shop");
    w("      POSTGRES_DB: shop");
    w("    volumes:");
    w("      - db-data:/var/lib/postgresql/data");
  }
  replicas.forEach((id) => {
    const src = v.ids.find((s) => v.from(s, "replica").includes(id) && kindOf(s) === "db");
    w(`  ${svc(id)}: # ${slotLabel(id)}（本番DB の写し）`);
    if (!src) w("    # ※ 本番DB とつながっていないので、写す元がありません");
    w("    # 写し（レプリケーション）を本当に動かすには、本番DB にも写し用のユーザーと設定が要ります（ここでは省略）");
    w("    image: postgres:16");
    w("    user: postgres");
    w("    environment:");
    w("      PGPASSWORD: repl");
    w("    command: >");
    w(`      bash -c "until pg_basebackup -h ${src ?? "db"} -U repl -D /var/lib/postgresql/data -R -X stream; do sleep 2; done && exec postgres"`);
    if (src) w(`    depends_on: [${src}]`);
  });
  const queue = v.one("queue");
  if (queue) {
    w(`  ${queue}: # キュー`);
    w("    image: rabbitmq:3-management");
  }
  const backup = v.one("backup");
  if (backup) {
    const src = v.ids.find((s) => v.from(s, "backup").includes(backup));
    w(`  ${backup}: # バックアップ（1時間ごとに DB を保存）`);
    if (!src) w("    # ※ DB とつながっていないので、保存するものがありません");
    w("    image: postgres:16");
    w("    environment:");
    w("      PGPASSWORD: shop");
    w("    volumes:");
    w("      - ./backups:/backups");
    w(`    command: sh -c 'while true; do pg_dump -h ${src ? svc(src) : "db"} -U shop shop > /backups/shop-$$(date +%Y%m%d%H%M).sql; sleep 3600; done'`);
  }
  const monitor = v.one("monitor");
  if (monitor) {
    w(`  ${monitor}: # 監視（数字を集める Prometheus。見張る先は prometheus.yml に書く）`);
    w("    image: prom/prometheus:v2.53.0");
    w("    ports:");
    w('      - "9090:9090"');
  }
  if (db) {
    w("volumes:");
    w("  db-data:");
  }
  return L.join("\n") + "\n";
}

/** サーバー・ワーカーの環境変数（どこにつながっているか） */
function env(w: (s?: string) => void, v: View, id: NodeId) {
  const e: string[] = [];
  const db = v.from(id, "db")[0];
  const reps = v.from(id, "replica");
  if (db) e.push(`DATABASE_URL: postgres://shop:shop@${db}:5432/shop`);
  if (reps.length) e.push(`DATABASE_READ_URLS: ${reps.map((r) => `postgres://shop:shop@${svc(r)}:5432/shop`).join(",")}`);
  const cache = v.from(id, "cache")[0];
  if (cache) e.push(`REDIS_URL: redis://${cache}:6379`);
  const queue = kindOf(id) === "worker" ? v.ids.find((s) => kindOf(s) === "queue" && v.from(s, "worker").includes(id)) : v.from(id, "queue")[0];
  if (queue) e.push(`QUEUE_URL: amqp://${queue}:5672`);
  if (!e.length) return;
  w("    environment:");
  for (const x of e) w(`      ${x}`);
}

function deps(w: (s?: string) => void, v: View, id: NodeId) {
  const list = [...v.from(id, "db"), ...v.from(id, "replica"), ...v.from(id, "cache"), ...v.from(id, "queue")];
  if (kindOf(id) === "worker") {
    const q = v.ids.find((s) => kindOf(s) === "queue" && v.from(s, "worker").includes(id));
    if (q) list.push(q);
  }
  if (list.length) w(`    depends_on: [${list.map(svc).join(", ")}]`);
}

/* ------------------------------------------------------------ nginx.conf */

function nginx(v: View): string | null {
  const lb = v.one("lb");
  if (!lb) return null;
  const apps = v.from(lb, "app");
  const L = [
    "# ロードバランサーの設定（docker-compose の lb が読む）",
    "events {}",
    "http {",
    "  upstream shop {",
    "    least_conn; # いちばんすいているサーバーへ",
    ...(apps.length ? apps.map((a) => `    server ${a}:3000 max_fails=3 fail_timeout=10s; # 3回失敗したら、しばらく送らない（ヘルスチェック）`) : ["    # ※ つながっているサーバーがありません"]),
    "  }",
    "  server {",
    "    listen 80;",
    "    location / {",
    "      proxy_pass http://shop;",
    "    }",
    "  }",
    "}",
  ];
  return L.join("\n") + "\n";
}

/* ------------------------------------------------------------ Terraform（AWS） */

function terraform(v: View): string {
  const L: string[] = [];
  const w = (s = "") => L.push(s);
  const lb = v.one("lb"), cdn = v.one("cdn"), waf = v.one("waf"), dns = v.one("dns"), region = v.one("region");
  const auto = v.one("auto"), cache = v.one("cache"), db = v.one("db"), queue = v.one("queue"), backup = v.one("backup"), monitor = v.one("monitor");
  const replicas = v.of("replica");
  const scaled = auto ? v.from(auto, "app") : [];
  const fixedApps = v.of("app").filter((a) => !scaled.includes(a));
  const lbApps = lb ? v.from(lb, "app") : [];

  w("# わんこ商店の構成を、AWS に作る Terraform（学習用の見本）");
  w("# terraform init → terraform plan で、何が作られるかを確かめられます。");
  w("# terraform apply すると本当に作られて、お金がかかります。使い終わったら terraform destroy で消そう。");
  w();
  w("terraform {");
  w("  required_providers {");
  w('    aws = { source = "hashicorp/aws", version = "~> 5.0" }');
  w("  }");
  w("}");
  w();
  w('provider "aws" {');
  w('  region = "ap-northeast-1" # 東京');
  w("}");
  if (region) {
    w();
    w('provider "aws" {');
    w('  alias  = "osaka"');
    w('  region = "ap-northeast-3" # 大阪（予備の拠点）');
    w("}");
  }
  w();
  w('variable "ami_id" {');
  w('  description = "サーバーの OS イメージ（AMI）の ID"');
  w("  type        = string");
  w("}");
  w('variable "vpc_id" {');
  w("  type = string");
  w("}");
  w('variable "subnet_ids" {');
  w('  description = "サーバーやロードバランサーを置くネットワーク（2つ以上）"');
  w("  type        = list(string)");
  w("}");
  if (db) {
    w('variable "db_password" {');
    w("  type      = string");
    w("  sensitive = true");
    w("}");
  }
  if (dns) {
    w('variable "domain" {');
    w('  default = "odekake.example"');
    w("}");
  }
  if (region) {
    w('variable "osaka_subnet_ids" {');
    w("  type = list(string)");
    w("}");
  }
  if (backup) {
    w('variable "backup_role_arn" {');
    w('  description = "AWS Backup が使う IAM ロール"');
    w("  type        = string");
    w("}");
  }

  // サーバー
  for (const id of fixedApps) {
    w();
    w(`# ${slotLabel(id)}（${PARTS.app.sizes[v.size(id)]!.label} サイズ）`);
    w(`resource "aws_instance" "${tf(id)}" {`);
    w("  ami           = var.ami_id");
    w(`  instance_type = "${APP_TYPE[v.size(id)]}"`);
    w("  subnet_id     = var.subnet_ids[0]");
    w(`  tags          = { Name = "shop-${id}" }`);
    w("}");
  }
  if (scaled.length) {
    const size = Math.max(...scaled.map(v.size));
    w();
    w(`# オートスケール：混み具合（CPU）に合わせて、サーバーを 1〜${scaled.length} 台のあいだで自動で増やす・減らす`);
    w('resource "aws_launch_template" "app" {');
    w('  name_prefix   = "shop-app-"');
    w("  image_id      = var.ami_id");
    w(`  instance_type = "${APP_TYPE[size]}"`);
    w("}");
    w();
    w('resource "aws_autoscaling_group" "app" {');
    w("  min_size            = 1");
    w(`  max_size            = ${scaled.length}`);
    w("  desired_capacity    = 1");
    w("  vpc_zone_identifier = var.subnet_ids");
    if (lb && scaled.some((a) => lbApps.includes(a))) w("  target_group_arns   = [aws_lb_target_group.app.arn]");
    w("  launch_template {");
    w("    id      = aws_launch_template.app.id");
    w('    version = "$Latest"');
    w("  }");
    w("}");
    w();
    w('resource "aws_autoscaling_policy" "cpu" {');
    w('  name                   = "keep-cpu-60"');
    w("  autoscaling_group_name = aws_autoscaling_group.app.name");
    w('  policy_type            = "TargetTrackingScaling"');
    w("  target_tracking_configuration {");
    w("    predefined_metric_specification {");
    w('      predefined_metric_type = "ASGAverageCPUUtilization"');
    w("    }");
    w("    target_value = 60 # 60% くらいの混み具合をたもつ");
    w("  }");
    w("}");
  }

  // ロードバランサー
  if (lb) {
    w();
    w("# ロードバランサー（ヘルスチェックで、止まったサーバーには送らない）");
    w(`resource "aws_lb" "${tf(lb)}" {`);
    w('  name               = "shop-lb"');
    w('  load_balancer_type = "application"');
    w("  subnets            = var.subnet_ids");
    w("}");
    w();
    w('resource "aws_lb_target_group" "app" {');
    w('  name     = "shop-app"');
    w("  port     = 3000");
    w('  protocol = "HTTP"');
    w("  vpc_id   = var.vpc_id");
    w("  health_check {");
    w('    path     = "/health"');
    w("    interval = 10");
    w("  }");
    w("}");
    w();
    w('resource "aws_lb_listener" "http" {');
    w(`  load_balancer_arn = aws_lb.${tf(lb)}.arn`);
    w("  port              = 80");
    w('  protocol          = "HTTP"');
    w("  default_action {");
    w('    type             = "forward"');
    w("    target_group_arn = aws_lb_target_group.app.arn");
    w("  }");
    w("}");
    for (const a of lbApps.filter((x) => fixedApps.includes(x))) {
      w();
      w(`resource "aws_lb_target_group_attachment" "${tf(a)}" {`);
      w("  target_group_arn = aws_lb_target_group.app.arn");
      w(`  target_id        = aws_instance.${tf(a)}.id`);
      w("  port             = 3000");
      w("}");
    }
  }

  // キャッシュ
  if (cache) {
    w();
    w("# キャッシュ（Redis）");
    w(`resource "aws_elasticache_cluster" "${tf(cache)}" {`);
    w('  cluster_id      = "shop-cache"');
    w('  engine          = "redis"');
    w('  node_type       = "cache.t3.micro"');
    w("  num_cache_nodes = 1");
    w("}");
  }

  // データベース
  if (db) {
    const keep = backup ? 7 : replicas.length ? 1 : 0;
    w();
    w(`# データベース（PostgreSQL・${PARTS.db.sizes[v.size(db)]!.label} サイズ）`);
    w(`resource "aws_db_instance" "${tf(db)}" {`);
    w('  identifier              = "shop-db"');
    w('  engine                  = "postgres"');
    w('  engine_version          = "16"');
    w(`  instance_class          = "${DB_TYPE[v.size(db)]}"`);
    w("  allocated_storage       = 20");
    w('  username                = "shop"');
    w("  password                = var.db_password");
    w(
      `  backup_retention_period = ${keep}${backup ? " # 毎日の自動バックアップを7日ぶん残す" : replicas.length ? " # 予備DB を作るには、自動バックアップが1日以上必要" : ""}`,
    );
    w("  skip_final_snapshot     = true");
    w("}");
  }
  for (const r of replicas) {
    const src = v.ids.find((s) => kindOf(s) === "db" && v.from(s, "replica").includes(r));
    w();
    w(`# ${slotLabel(r)}（本番DB の写し。読みこみを手伝い、本番が止まったら昇格させる）`);
    if (!src) w("# ※ 本番DB とつながっていないので、写す元がありません");
    w(`resource "aws_db_instance" "${tf(r)}" {`);
    w(`  identifier          = "shop-${svc(r)}"`);
    w(`  replicate_source_db = aws_db_instance.${tf(src ?? "db")}.identifier`);
    w('  instance_class      = "db.t3.micro"');
    w("  skip_final_snapshot = true");
    w("}");
  }
  if (backup && db) {
    w();
    w("# バックアップ（AWS Backup で、毎日 DB を別の場所に保存する）");
    w('resource "aws_backup_vault" "main" {');
    w('  name = "shop-backup"');
    w("}");
    w();
    w('resource "aws_backup_plan" "daily" {');
    w('  name = "shop-daily"');
    w("  rule {");
    w('    rule_name         = "daily"');
    w("    target_vault_name = aws_backup_vault.main.name");
    w('    schedule          = "cron(0 18 * * ? *)" # 毎日 午前3時（日本時間）');
    w("    lifecycle {");
    w("      delete_after = 30");
    w("    }");
    w("  }");
    w("}");
    w();
    w('resource "aws_backup_selection" "db" {');
    w('  name         = "shop-db"');
    w("  plan_id      = aws_backup_plan.daily.id");
    w("  iam_role_arn = var.backup_role_arn");
    w(`  resources    = [aws_db_instance.${tf(db)}.arn]`);
    w("}");
  }

  // キューとワーカー
  if (queue) {
    w();
    w("# キュー（重い仕事の順番待ちの列）");
    w(`resource "aws_sqs_queue" "${tf(queue)}" {`);
    w('  name                       = "shop-jobs"');
    w("  visibility_timeout_seconds = 60");
    w("}");
  }
  for (const id of v.of("worker")) {
    w();
    w(`# ${slotLabel(id)}（キューの仕事を裏で片づける）`);
    w(`resource "aws_instance" "${tf(id)}" {`);
    w("  ami           = var.ami_id");
    w('  instance_type = "t3.small"');
    w("  subnet_id     = var.subnet_ids[0]");
    w(`  tags          = { Name = "shop-${id}", Role = "worker" }`);
    w("}");
  }

  // 入口：WAF・CDN・DNS
  const behindWaf = waf ? v.from(waf).find((b) => ["lb", "app"].includes(kindOf(b))) : undefined;
  if (waf) {
    w();
    w("# WAF（よくある攻撃の形と、1つの相手からの多すぎるアクセスを止める）");
    w(`resource "aws_wafv2_web_acl" "${tf(waf)}" {`);
    w('  name  = "shop-waf"');
    w('  scope = "REGIONAL"');
    w("  default_action {");
    w("    allow {}");
    w("  }");
    w("  rule {");
    w('    name     = "common-attacks"');
    w("    priority = 1");
    w("    override_action {");
    w("      none {}");
    w("    }");
    w("    statement {");
    w("      managed_rule_group_statement {");
    w('        name        = "AWSManagedRulesCommonRuleSet"');
    w('        vendor_name = "AWS"');
    w("      }");
    w("    }");
    w("    visibility_config {");
    w("      cloudwatch_metrics_enabled = true");
    w('      metric_name                = "common-attacks"');
    w("      sampled_requests_enabled   = true");
    w("    }");
    w("  }");
    w("  rule {");
    w('    name     = "too-many"');
    w("    priority = 2");
    w("    action {");
    w("      block {}");
    w("    }");
    w("    statement {");
    w("      rate_based_statement {");
    w("        limit              = 1000 # 5分で1000回をこえた相手は止める");
    w('        aggregate_key_type = "IP"');
    w("      }");
    w("    }");
    w("    visibility_config {");
    w("      cloudwatch_metrics_enabled = true");
    w('      metric_name                = "too-many"');
    w("      sampled_requests_enabled   = true");
    w("    }");
    w("  }");
    w("  visibility_config {");
    w("    cloudwatch_metrics_enabled = true");
    w('    metric_name                = "shop-waf"');
    w("    sampled_requests_enabled   = true");
    w("  }");
    w("}");
    if (behindWaf && kindOf(behindWaf) === "lb") {
      w();
      w(`resource "aws_wafv2_web_acl_association" "${tf(waf)}" {`);
      w(`  resource_arn = aws_lb.${tf(behindWaf)}.arn`);
      w(`  web_acl_arn  = aws_wafv2_web_acl.${tf(waf)}.arn`);
      w("}");
    } else w("# ※ AWS の WAF は、サーバー（EC2）に直接はつけられません。ロードバランサーの前に置こう");
  }

  /** 外から見たお店の入口（DNS が指す先） */
  const host = (id: NodeId | undefined): string | null => {
    if (!id) return null;
    const k = kindOf(id);
    if (k === "lb") return `aws_lb.${tf(id)}.dns_name`;
    if (k === "cdn") return `aws_cloudfront_distribution.${tf(id)}.domain_name`;
    if (k === "waf") return host(behindWaf);
    if (k === "app") return scaled.includes(id) ? null : `aws_instance.${tf(id)}.public_dns`;
    return null;
  };
  if (cdn) {
    const origin = host(v.from(cdn).find((b) => ["waf", "lb", "app"].includes(kindOf(b))));
    w();
    w("# CDN（画像などを、利用者の近くの拠点から返す）");
    w(`resource "aws_cloudfront_distribution" "${tf(cdn)}" {`);
    w("  enabled = true");
    w("  origin {");
    w(`    domain_name = ${origin ?? '"" # ※ CDN の後ろにつながっている入口がありません'}`);
    w('    origin_id   = "shop"');
    w("    custom_origin_config {");
    w("      http_port              = 80");
    w("      https_port             = 443");
    w('      origin_protocol_policy = "http-only"');
    w('      origin_ssl_protocols   = ["TLSv1.2"]');
    w("    }");
    w("  }");
    w("  default_cache_behavior {");
    w('    target_origin_id       = "shop"');
    w('    viewer_protocol_policy = "redirect-to-https"');
    w('    allowed_methods        = ["GET", "HEAD"]');
    w('    cached_methods         = ["GET", "HEAD"]');
    w('    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS が用意した「よくキャッシュする」設定');
    w("  }");
    w("  restrictions {");
    w("    geo_restriction {");
    w('      restriction_type = "none"');
    w("    }");
    w("  }");
    w("  viewer_certificate {");
    w("    cloudfront_default_certificate = true");
    w("  }");
    w("}");
  }

  if (region) {
    w();
    w("# 予備の拠点（大阪）。東京と同じサーバーと DB の写しを、大阪にも用意しておく（ここでは入口のロードバランサーだけ）");
    w('resource "aws_lb" "osaka" {');
    w('  provider           = aws.osaka');
    w('  name               = "shop-lb-osaka"');
    w('  load_balancer_type = "application"');
    w("  subnets            = var.osaka_subnet_ids");
    w("}");
  }

  if (dns) {
    const ttl = REAL_TTL[v.size(dns)] ?? 300;
    const entry = host(cdn && v.from(USERS).includes(cdn) ? cdn : v.from(USERS).find((b) => ["waf", "lb", "app"].includes(kindOf(b))));
    w();
    w(`# DNS（名前 → 住所）。TTL ${ttl}秒${v.size(dns) === 1 ? "（短め：切りかえが早く伝わる）" : ""}`);
    w('resource "aws_route53_zone" "main" {');
    w("  name = var.domain");
    w("}");
    if (region && lb) {
      w();
      w("# いつもの拠点の様子を、DNS が確かめる（止まっていたら大阪を案内する）");
      w('resource "aws_route53_health_check" "tokyo" {');
      w(`  fqdn              = aws_lb.${tf(lb)}.dns_name`);
      w("  port              = 80");
      w('  type              = "HTTP"');
      w('  resource_path     = "/health"');
      w("  failure_threshold = 3");
      w("  request_interval  = 10");
      w("}");
      for (const [name, target, type] of [
        ["tokyo", entry ?? `aws_lb.${tf(lb)}.dns_name`, "PRIMARY"],
        ["osaka", "aws_lb.osaka.dns_name", "SECONDARY"],
      ] as const) {
        w();
        // terraform fmt と同じく、= の位置をそろえる（health_check_id があるときは1文字ぶん広い）
        const k = (key: string) => `  ${key.padEnd(name === "tokyo" ? 15 : 14)} =`;
        w(`resource "aws_route53_record" "${name}" {`);
        w(`${k("zone_id")} aws_route53_zone.main.zone_id`);
        w(`${k("name")} "www.\${var.domain}"`);
        w(`${k("type")} "CNAME"`);
        w(`${k("ttl")} ${ttl}`);
        w(`${k("records")} [${target}]`);
        w(`${k("set_identifier")} "${name}"`);
        if (name === "tokyo") w(`${k("health_check_id")} aws_route53_health_check.tokyo.id`);
        w("  failover_routing_policy {");
        w(`    type = "${type}"`);
        w("  }");
        w("}");
      }
    } else {
      w();
      w('resource "aws_route53_record" "www" {');
      w("  zone_id = aws_route53_zone.main.zone_id");
      w('  name    = "www.${var.domain}"');
      w('  type    = "CNAME"');
      w(`  ttl     = ${ttl}`);
      if (!entry) w("  # ※ 決まった住所の入口がありません（オートスケールのサーバーは住所が変わるので、ロードバランサーを前に置こう）");
      w(`  records = [${entry ?? ""}]`);
      w("}");
    }
  }

  // 監視
  if (monitor) {
    const watched = v.from(monitor);
    w();
    w("# 監視（CloudWatch）。おかしな値になったら、アラートを送る");
    w('resource "aws_sns_topic" "alerts" {');
    w('  name = "shop-alerts"');
    w("}");
    for (const t of watched) {
      const k = kindOf(t);
      if (k === "app" && fixedApps.includes(t)) {
        w();
        w(`# ${slotLabel(t)} が止まったら、知らせて自動で再起動する`);
        w(`resource "aws_cloudwatch_metric_alarm" "${tf(t)}_down" {`);
        w(`  alarm_name          = "shop-${t}-down"`);
        w('  namespace           = "AWS/EC2"');
        w('  metric_name         = "StatusCheckFailed_Instance"');
        w('  statistic           = "Maximum"');
        w("  period              = 60");
        w("  evaluation_periods  = 2");
        w("  threshold           = 1");
        w('  comparison_operator = "GreaterThanOrEqualToThreshold"');
        w(`  dimensions          = { InstanceId = aws_instance.${tf(t)}.id }`);
        w('  alarm_actions       = [aws_sns_topic.alerts.arn, "arn:aws:automate:ap-northeast-1:ec2:reboot"]');
        w("}");
      } else if (k === "db" || k === "replica") {
        w();
        w(`# ${slotLabel(t)} がいそがしすぎたら、知らせる`);
        w(`resource "aws_cloudwatch_metric_alarm" "${tf(t)}_busy" {`);
        w(`  alarm_name          = "shop-${svc(t)}-busy"`);
        w('  namespace           = "AWS/RDS"');
        w('  metric_name         = "CPUUtilization"');
        w('  statistic           = "Average"');
        w("  period              = 60");
        w("  evaluation_periods  = 3");
        w("  threshold           = 80");
        w('  comparison_operator = "GreaterThanThreshold"');
        w(`  dimensions          = { DBInstanceIdentifier = aws_db_instance.${tf(t)}.identifier }`);
        w("  alarm_actions       = [aws_sns_topic.alerts.arn]");
        w("}");
      }
    }
    if (lb) {
      w();
      w("# ロードバランサーから見て、元気のないサーバーがいたら知らせる");
      w('resource "aws_cloudwatch_metric_alarm" "unhealthy" {');
      w('  alarm_name          = "shop-unhealthy-servers"');
      w('  namespace           = "AWS/ApplicationELB"');
      w('  metric_name         = "UnHealthyHostCount"');
      w('  statistic           = "Maximum"');
      w("  period              = 60");
      w("  evaluation_periods  = 2");
      w("  threshold           = 1");
      w('  comparison_operator = "GreaterThanOrEqualToThreshold"');
      w("  dimensions = {");
      w(`    LoadBalancer = aws_lb.${tf(lb)}.arn_suffix`);
      w("    TargetGroup  = aws_lb_target_group.app.arn_suffix");
      w("  }");
      w("  alarm_actions = [aws_sns_topic.alerts.arn]");
      w("}");
    }
  }
  return L.join("\n") + "\n";
}

/* ------------------------------------------------------------ まとめ */

function rows(v: View): ExportRow[] {
  const out: ExportRow[] = [];
  const n = (k: PartKind) => v.of(k).length;
  const add = (k: PartKind, local: string, aws: string) => {
    if (n(k)) out.push({ part: `${PARTS[k].name}${n(k) > 1 ? ` ×${n(k)}` : ""}`, local, aws });
  };
  add("dns", "—（パソコンの中では localhost）", "Route 53");
  add("cdn", "—", "CloudFront");
  add("waf", "—", "AWS WAF");
  add("region", "—", "大阪リージョン ＋ Route 53 のフェイルオーバー");
  add("lb", "nginx", "Application Load Balancer");
  add("auto", "—", "Auto Scaling グループ");
  add("app", "app（Dockerfile から）", v.one("auto") ? "EC2（Auto Scaling）" : "EC2");
  add("cache", "Redis", "ElastiCache（Redis）");
  add("db", "PostgreSQL", "RDS（PostgreSQL）");
  add("replica", "PostgreSQL（写し）", "RDS リードレプリカ");
  add("queue", "RabbitMQ", "SQS");
  add("worker", "worker（Dockerfile から）", "EC2");
  add("backup", "pg_dump（1時間ごと）", "AWS Backup");
  add("monitor", "Prometheus", "CloudWatch アラーム ＋ SNS");
  return out;
}

export function exportDesign(d: Design): { files: ExportFile[]; rows: ExportRow[] } {
  const v = view(d);
  const files: ExportFile[] = [{ name: "docker-compose.yml", lang: "yaml", body: compose(v) }];
  const conf = nginx(v);
  if (conf) files.push({ name: "nginx.conf", lang: "nginx", body: conf });
  files.push({ name: "main.tf", lang: "hcl", body: terraform(v) });
  return { files, rows: rows(v) };
}
