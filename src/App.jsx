import React, { useState, useEffect, useRef } from "react";

// Função para normalizar slugs de loja
const slug = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Lista de lojas e slugs correspondentes
const lojas = {
  "toyota-morumbi": "Toyota Morumbi",
  "toyota-nacoes": "Toyota Nações",
  "hyundai-barra-funda": "Hyundai Barra Funda",
  "hyundai-guarulhos": "Hyundai Guarulhos",
  "byd-ibirapuera": "BYD Ibirapuera",
  "byd-alphaville": "BYD Alphaville",
};

// Parâmetro da loja e modo somente leitura pela URL
const params = new URLSearchParams(window.location.search);
const lojaParamRaw = params.get("loja") || "";
const lojaParam = slug(lojaParamRaw);
const lojaAtual = lojas[lojaParam] || "Loja Padrão";
const readOnly = params.get("read") === "1";

// Storage por loja
const STORAGE_KEY = `gb_perf_vendedores_${lojaParam || "default"}`;

// Navegação rápida entre lojas via botões
function handleGoLoja(key) {
  const sp = new URLSearchParams(window.location.search);
  sp.set("loja", key);
  if (readOnly) sp.set("read", "1");
  window.location.search = sp.toString();
}

// Alternar modo somente leitura
function handleToggleRead() {
  const sp = new URLSearchParams(window.location.search);
  if (readOnly) {
    sp.delete("read");
  } else {
    sp.set("read", "1");
  }
  window.location.search = sp.toString();
}

// ==== Botões Exportar/Importar (mantêm-se ativos mesmo em modo leitura) ====
function handleExportJSON() {
  if (typeof window.gbExportJSON === "function") {
    window.gbExportJSON();
  } else {
    alert(
      "A função de exportação não está carregada ainda. Abra a página completa do dashboard."
    );
  }
}
function handleImportJSON(file) {
  if (!file) return;
  if (typeof window.gbImportJSON === "function") {
    window.gbImportJSON(file);
  } else {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(reader.result);
        alert("Arquivo lido. Importe pelo dashboard quando disponível.");
      } catch {
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }
}

// === Paleta Grand Brasil (aproximação) ===
const theme = {
  bg: "#F5F7F6",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  primary: "#0A7B34", // verde GB
  primaryDark: "#075A27",
  accent: "#FFC107", // dourado
  danger: "#D64545",
};

// === Config ===
const WEIGHTS = {
  vendas: 0.3,
  destaque: 0.15,
  despachante: 0.15,
  fi: 0.15,
  fiRent: 0.15,
  tradeIn: 0.15,
};
const MAXIMOS = {
  vendas: 8,
  destaque: 2,
  despachante: 0.7,
  fi: 0.35,
  fiRent: 3250,
  tradeIn: 0.25,
};

// === Helpers ===
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const percent = (n) => (n * 100).toFixed(1) + "%";
const uid = () =>
  crypto?.randomUUID?.() ??
  `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

function gradeFromScore(score, hasZeroMetric) {
  if (hasZeroMetric) return "F";
  const pct = score * 100;
  if (pct > 95) return "A";
  if (pct >= 85) return "B";
  if (pct >= 75) return "C";
  if (pct >= 65) return "D";
  return "F";
}
function useNormalizedWeights() {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const normalized = Object.fromEntries(
    Object.entries(WEIGHTS).map(([k, v]) => [k, v / sum])
  );
  return { normalized, sum };
}
const toNum = (v) => {
  if (typeof v !== "string") return Number(v) || 0;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// === Modelo ===
const emptyRow = () => ({
  id: uid(),
  nome: "",
  loja: "",
  metas: { ...MAXIMOS },
  real: {
    vendas: "0",
    destaque: "0",
    despachante: "0",
    fi: "0",
    fiRent: "0",
    tradeIn: "0",
  },
  extras: { gmbNota: "", reclameAqui: "" },
  obs: "",
});

// === UI Base ===
const Button = ({ children, variant = "solid", ...rest }) => {
  const common = {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
  const styles =
    variant === "solid"
      ? {
          background: theme.primary,
          color: "#fff",
          border: `1px solid ${theme.primaryDark}`,
        }
      : {
          background: "#fff",
          color: theme.text,
          border: `1px solid ${theme.border}`,
        };
  return (
    <button style={{ ...common, ...styles }} {...rest}>
      {children}
    </button>
  );
};

const Box = ({ title, children, style }) => (
  <div
    style={{
      border: `1px solid ${theme.border}`,
      borderRadius: 18,
      padding: 18,
      background: theme.card,
      ...style,
    }}
  >
    {title && (
      <div style={{ fontSize: 12, color: theme.muted, marginBottom: 8 }}>
        {title}
      </div>
    )}
    {children}
  </div>
);

const Chip = ({ children, tone = "neutral" }) => {
  const tones = {
    neutral: { bg: "#F3F4F6", fg: "#374151" },
    good: { bg: "#E8F5EC", fg: theme.primary },
    bad: { bg: "#FDE8E8", fg: theme.danger },
    accent: { bg: "#FFF7E0", fg: "#9A7500" },
  }[tone];
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        background: tones.bg,
        color: tones.fg,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
};

// Input texto (nome/loja)
const TextField = ({ value, onChange, placeholder, style }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      padding: 12,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      width: "100%",
      ...style,
    }}
  />
);

// Input numérico com fix do foco
const NumberField = ({ value, onChange, placeholder, style }) => {
  const ref = useRef(null);
  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    requestAnimationFrame(() => {
      if (ref.current) {
        const pos = val.length;
        ref.current.focus({ preventScroll: true });
        try {
          ref.current.setSelectionRange(pos, pos);
        } catch {}
      }
    });
  };
  return (
    <input
      ref={ref}
      value={value}
      onChange={handleChange}
      inputMode="decimal"
      placeholder={placeholder}
      style={{
        padding: 12,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        width: "100%",
        ...style,
      }}
    />
  );
};

const MetricRow = ({
  rowId,
  k,
  label,
  valueMeta,
  valueReal,
  pct,
  onChange,
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1.3fr 1fr 1fr 0.8fr",
      gap: 16,
      alignItems: "end",
    }}
  >
    <div style={{ fontSize: 14, color: theme.text, fontWeight: 600 }}>
      {label}
    </div>
    <div>
      <label
        style={{
          fontSize: 12,
          color: theme.muted,
          display: "block",
          marginBottom: 6,
        }}
      >
        Meta
      </label>
      <NumberField
        value={valueMeta}
        onChange={(v) => onChange(rowId, `metas.${k}`, v)}
      />
    </div>
    <div>
      <label
        style={{
          fontSize: 12,
          color: theme.muted,
          display: "block",
          marginBottom: 6,
        }}
      >
        Real
      </label>
      <NumberField
        value={valueReal}
        onChange={(v) => onChange(rowId, `real.${k}`, v)}
      />
    </div>
    <div style={{ alignSelf: "center" }}>
      <Chip tone={pct >= 1 ? "good" : pct >= 0.8 ? "accent" : "neutral"}>
        {percent(pct)}
      </Chip>
    </div>
  </div>
);

export default function App() {
  const [rows, setRows] = useState([emptyRow()]);
  const { normalized } = useNormalizedWeights();

  // carregar/salvar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRows(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [rows]);

  const update = (id, path, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = structuredClone(row);
        const parts = path.split(".");
        let ref = next;
        for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
        ref[parts[parts.length - 1]] = value;
        return next;
      })
    );
  };

  // Agora, ao adicionar vendedor, já preenche a coluna Loja com a loja atual
  const addRow = () =>
    setRows((r) => [...r, { ...emptyRow(), loja: lojaAtual }]);
  const removeRow = (id) => setRows((r) => r.filter((x) => x.id !== id));

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance_${lojaParam || "default"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setRows(Array.isArray(data) ? data : [emptyRow()]);
      } catch {
        alert("Arquivo inválido");
      }
    };
    reader.readAsText(file);
  };

  const calcular = (row) => {
    const metasC = {
      vendas: clamp(toNum(row.metas.vendas), 0, MAXIMOS.vendas),
      destaque: clamp(toNum(row.metas.destaque), 0, MAXIMOS.destaque),
      despachante: clamp(toNum(row.metas.despachante), 0, MAXIMOS.despachante),
      fi: clamp(toNum(row.metas.fi), 0, MAXIMOS.fi),
      fiRent: clamp(toNum(row.metas.fiRent), 0, MAXIMOS.fiRent),
      tradeIn: clamp(toNum(row.metas.tradeIn), 0, MAXIMOS.tradeIn),
    };
    const realC = {
      vendas: clamp(toNum(row.real.vendas), 0, 9999),
      destaque: clamp(toNum(row.real.destaque), 0, 9999),
      despachante: clamp(toNum(row.real.despachante), 0, 1),
      fi: clamp(toNum(row.real.fi), 0, 1),
      fiRent: clamp(toNum(row.real.fiRent), 0, 999999),
      tradeIn: clamp(toNum(row.real.tradeIn), 0, 1),
    };
    const perc = {
      vendas:
        metasC.vendas > 0
          ? clamp(realC.vendas / metasC.vendas, 0, 1.2)
          : 0,
      destaque:
        metasC.destaque > 0
          ? clamp(realC.destaque / metasC.destaque, 0, 1.2)
          : 0,
      despachante:
        metasC.despachante > 0
          ? clamp(realC.despachante / metasC.despachante, 0, 1.2)
          : 0,
      fi: metasC.fi > 0 ? clamp(realC.fi / metasC.fi, 0, 1.2) : 0,
      fiRent:
        metasC.fiRent > 0
          ? clamp(realC.fiRent / metasC.fiRent, 0, 1.2)
          : 0,
      tradeIn:
        metasC.tradeIn > 0
          ? clamp(realC.tradeIn / metasC.tradeIn, 0, 1.2)
          : 0,
    };
    // Exceção: zerar apenas 'destaque' NÃO reprova
    const zeroMetrics = Object.keys(metasC).filter(
      (k) => metasC[k] > 0 && realC[k] === 0
    );
    const hasZeroMetric = zeroMetrics.some((k) => k !== "destaque");

    const scoreBase =
      perc.vendas * normalized.vendas +
      perc.destaque * normalized.destaque +
      perc.despachante * normalized.despachante +
      perc.fi * normalized.fi +
      perc.fiRent * normalized.fiRent +
      perc.tradeIn * normalized.tradeIn;
    const gmb = toNum(row.extras.gmbNota);
    const ra = (row.extras.reclameAqui || "").toLowerCase();
    const bonusGMB = !isNaN(gmb) && gmb >= 4.6 ? 0.05 : 0;
    const bonusRA = ra === "ótimo" || ra === "otimo" ? 0.05 : 0;
    const finalScore = clamp(scoreBase + bonusGMB + bonusRA, 0, 1.2);

    return {
      perc,
      scoreBase,
      finalScore,
      grade: gradeFromScore(finalScore, hasZeroMetric),
      hasZeroMetric,
      bonus: bonusGMB + bonusRA,
    };
  };

  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        background: theme.bg,
        color: theme.text,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: theme.card,
          borderBottom: `1px solid ${theme.border}`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "18px 28px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 10,
              height: 28,
              background: theme.primary,
              borderRadius: 3,
            }}
          />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            Performance vendedores
          </h1>

          {/* Loja ativa + leitura */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#F3F4F6",
                color: "#374151",
                fontSize: 12,
                fontWeight: 700,
                alignSelf: "center",
              }}
            >
              {lojaAtual}
            </span>
            {readOnly && (
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#FDE8E8",
                  color: theme.danger,
                  fontSize: 12,
                  fontWeight: 800,
                  alignSelf: "center",
                }}
              >
                SOMENTE LEITURA
              </span>
            )}
          </div>
        </div>

        {/* Botões de navegação por loja + leitura + export/import (sempre ativos) */}
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 28px 16px 28px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {Object.entries(lojas).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleGoLoja(key)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border:
                  key === lojaParam
                    ? "1px solid #0A7B34"
                    : `1px solid ${theme.border}`,
                background: key === lojaParam ? "#0A7B34" : "#FFFFFF",
                color: key === lojaParam ? "#FFFFFF" : theme.text,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}

          <button
            onClick={handleToggleRead}
            title={
              readOnly ? "Voltar ao modo edição" : "Ativar modo somente leitura"
            }
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: readOnly
                ? "1px solid #0A7B34"
                : `1px solid ${theme.border}`,
              background: readOnly ? "#0A7B34" : "#FFFFFF",
              color: readOnly ? "#FFFFFF" : theme.text,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {readOnly ? "Modo edição" : "Somente leitura"}
          </button>

          {/* >>> ADICIONADO: botão para incluir vendedor (só no modo edição) */}
          {!readOnly && (
            <Button onClick={addRow}>+ Adicionar vendedor</Button>
          )}
          {/* <<< */}

          <button
            onClick={exportJSON}
            title="Exportar JSON das metas/resultados desta loja"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              background: "#FFFFFF",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Exportar JSON
          </button>
          <label
            title="Importar JSON para esta loja"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              background: "#FFFFFF",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Importar JSON
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) =>
                e.target.files?.[0] && importJSON(e.target.files[0])
              }
            />
          </label>
        </div>
      </header>

      {/* Conteúdo: fica bloqueado em modo leitura, mas header continua clicável */}
      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 28,
          pointerEvents: readOnly ? "none" : "auto",
          opacity: readOnly ? 0.92 : 1,
        }}
      >
        {rows.map((row) => {
          const r = calcular(row);
          return (
            <section
              key={row.id}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 20,
                padding: 26,
                marginBottom: 32,
                background: theme.card,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              {/* Nome / Loja */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <TextField
                  placeholder="Nome do vendedor"
                  value={row.nome}
                  onChange={(v) => update(row.id, "nome", v)}
                  style={{ maxWidth: 360 }}
                />
                <TextField
                  placeholder="Loja"
                  value={row.loja}
                  onChange={(v) => update(row.id, "loja", v)}
                  style={{ maxWidth: 260 }}
                />
                <div style={{ marginLeft: "auto" }}>
                  <Button variant="outline" onClick={() => removeRow(row.id)}>
                    Remover
                  </Button>
                </div>
              </div>

              {/* Classificação */}
              <Box title="Classificação" style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 42,
                        fontWeight: 900,
                        color:
                          r.grade === "F"
                            ? theme.danger
                            : r.grade === "A"
                            ? theme.primary
                            : theme.text,
                      }}
                    >
                      {r.grade}
                    </div>
                    <div style={{ fontSize: 12, color: theme.muted }}>
                      {r.hasZeroMetric
                        ? "(zerou métrica crítica)"
                        : "média ponderada"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {(r.finalScore * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 12, color: theme.muted }}>
                      bônus: {percent(r.bonus)}
                    </div>
                  </div>
                </div>
              </Box>

              {/* Grid 2 colunas na ordem solicitada */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: 22,
                  rowGap: 18,
                }}
              >
                {/* Linha 1 */}
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="vendas"
                    label="Meta de venda"
                    valueMeta={row.metas.vendas}
                    valueReal={row.real.vendas}
                    pct={r.perc.vendas}
                    onChange={update}
                  />
                </Box>
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="destaque"
                    label="Veículo destaque"
                    valueMeta={row.metas.destaque}
                    valueReal={row.real.destaque}
                    pct={r.perc.destaque}
                    onChange={update}
                  />
                </Box>

                {/* Linha 2 */}
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="despachante"
                    label="Despachante"
                    valueMeta={row.metas.despachante}
                    valueReal={row.real.despachante}
                    pct={r.perc.despachante}
                    onChange={update}
                  />
                </Box>
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="tradeIn"
                    label="Trade-in"
                    valueMeta={row.metas.tradeIn}
                    valueReal={row.real.tradeIn}
                    pct={r.perc.tradeIn}
                    onChange={update}
                  />
                </Box>

                {/* Linha 3 */}
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="fi"
                    label="F&I"
                    valueMeta={row.metas.fi}
                    valueReal={row.real.fi}
                    pct={r.perc.fi}
                    onChange={update}
                  />
                </Box>
                <Box>
                  <MetricRow
                    rowId={row.id}
                    k="fiRent"
                    label="Rentabilidade média F&I (R$)"
                    valueMeta={row.metas.fiRent}
                    valueReal={row.real.fiRent}
                    pct={r.perc.fiRent}
                    onChange={update}
                  />
                </Box>

                {/* Linha 4 - Bônus */}
                <Box title="Google Meu Negócio">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "end",
                    }}
                  >
                    <NumberField
                      value={row.extras.gmbNota}
                      onChange={(v) => update(row.id, "extras.gmbNota", v)}
                      placeholder="Nota (0–5)"
                    />
                    <Chip
                      tone={
                        toNum(row.extras.gmbNota) >= 4.6 ? "good" : "neutral"
                      }
                    >
                      {toNum(row.extras.gmbNota) >= 4.6
                        ? "+5 p.p. aplicado"
                        : "sem bônus"}
                    </Chip>
                  </div>
                </Box>
                <Box title="Reclame Aqui">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "end",
                    }}
                  >
                    <select
                      value={row.extras.reclameAqui}
                      onChange={(e) =>
                        update(row.id, "extras.reclameAqui", e.target.value)
                      }
                      style={{
                        padding: 12,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        width: "100%",
                      }}
                    >
                      <option value="">Selecione…</option>
                      <option>Ótimo</option>
                      <option>Bom</option>
                      <option>Regular</option>
                      <option>Ruim</option>
                      <option>Péssimo</option>
                    </select>
                    <Chip
                      tone={
                        (row.extras.reclameAqui || "").toLowerCase() ===
                          "ótimo" ||
                        (row.extras.reclameAqui || "").toLowerCase() === "otimo"
                          ? "good"
                          : "neutral"
                      }
                    >
                      {(row.extras.reclameAqui || "").toLowerCase() ===
                        "ótimo" ||
                      (row.extras.reclameAqui || "").toLowerCase() === "otimo"
                        ? "+5 p.p. aplicado"
                        : "sem bônus"}
                    </Chip>
                  </div>
                </Box>
              </div>

              {/* Observações */}
              <Box title="Observações" style={{ marginTop: 18 }}>
                <textarea
                  placeholder="Comentários, acordos de meta, exceções, etc."
                  value={row.obs}
                  onChange={(e) => update(row.id, "obs", e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 110,
                    padding: 12,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                  }}
                />
              </Box>
            </section>
          );
        })}
      </main>

      {/* Rodapé */}
      <footer style={{ borderTop: `1px solid ${theme.border}`, background: theme.card }}>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "14px 28px",
            color: theme.muted,
            fontSize: 12,
          }}
        >
          Percentuais por métrica são truncados em 120% antes da ponderação.
          Bônus +5 p.p. para GMB ≥ 4,6 e RA “Ótimo”.
        </div>
      </footer>
    </div>
  );
}
