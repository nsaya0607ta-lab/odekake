/**
 * 教育漢字（小学校で習う漢字）の配当学年。答えの grade が正しいかをテストで照合するための表。
 * 2020年度からの学年別漢字配当表にもとづく。ここには、出題・答え・似た字に出てくる字だけを入れる
 * （表にない字は「小学校で習わない字」としてあつかう）。字を足すときは配当表で学年を確かめてから入れる。
 */
import characterInfo from "./character-info-004-010.json";

export const KYOIKU_GRADES: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  一: 1, 口: 1, 二: 1, 三: 1, 七: 1, 八: 1, 十: 1, 日: 1, 小: 1, 人: 1,
  木: 1, 千: 1, 大: 1, 下: 1, 天: 1, 中: 1,
  心: 2, 少: 2,
  感: 3, 代: 3, 漢: 3, 丁: 3,
  成: 4, 必: 4, 夫: 4, 不: 4,
  ...Object.fromEntries(Object.entries(characterInfo)
    .filter(([, info]) => info.grade !== null)
    .map(([char, info]) => [char, info.grade as 1 | 2 | 3 | 4 | 5 | 6])),
};
