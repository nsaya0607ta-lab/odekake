"use client";

import { useMemo, useState } from "react";
import municipalityData from "@/lib/geo/municipalities.json";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";

type MunicipalityOption = { code: string; name: string; prefectureCode: string };

const ALL = municipalityData as MunicipalityOption[];

/**
 * 都道府県 → 市区町村の2段階セレクト。
 * 市区町村マスタはクライアント側で読み込み、選択された都道府県の分だけを表示する。
 */
export function MunicipalityPicker({
  defaultPrefectureCode = "",
  defaultMunicipalityCode = "",
  error,
}: {
  defaultPrefectureCode?: string;
  defaultMunicipalityCode?: string;
  error?: string;
}) {
  const [prefectureCode, setPrefectureCode] = useState(defaultPrefectureCode);
  const [municipalityCode, setMunicipalityCode] = useState(defaultMunicipalityCode);

  const options = useMemo(() => ALL.filter((m) => m.prefectureCode === prefectureCode), [prefectureCode]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="field-label" htmlFor="prefectureCode">
          都道府県
        </label>
        <select
          id="prefectureCode"
          className="field"
          value={prefectureCode}
          onChange={(e) => {
            setPrefectureCode(e.target.value);
            setMunicipalityCode("");
          }}
          required
        >
          <option value="">選択してください</option>
          {PREFECTURE_NAMES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="municipalityCode">
          市区町村
        </label>
        <select
          id="municipalityCode"
          name="municipalityCode"
          className="field"
          value={municipalityCode}
          onChange={(e) => setMunicipalityCode(e.target.value)}
          disabled={options.length === 0}
          required
        >
          <option value="">{prefectureCode ? "選択してください" : "先に都道府県を選択"}</option>
          {options.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
        {error ? <p className="mt-1 text-xs text-[#a85c6a]">{error}</p> : null}
      </div>
    </div>
  );
}
