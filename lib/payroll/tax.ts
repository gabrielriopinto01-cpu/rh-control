// Cálculo de encargos da folha (Brasil) — INSS progressivo, IRRF e FGTS.
// ⚠️ Atualizar estas tabelas anualmente (valores de referência 2025).

// ─── INSS — faixas progressivas (empregado CLT) ───────────────
// Cada faixa incide só sobre a parcela dentro dela.
const INSS_BRACKETS = [
  { upTo: 1518.00, rate: 0.075 },
  { upTo: 2793.88, rate: 0.09  },
  { upTo: 4190.83, rate: 0.12  },
  { upTo: 8157.41, rate: 0.14  },
]
const INSS_CEILING = 8157.41 // teto de contribuição

/** INSS progressivo: soma a contribuição de cada faixa. */
export function calcINSS(gross: number): number {
  const base = Math.min(gross, INSS_CEILING)
  let inss = 0
  let prev = 0
  for (const b of INSS_BRACKETS) {
    if (base > prev) {
      const slice = Math.min(base, b.upTo) - prev
      inss += slice * b.rate
      prev = b.upTo
    } else break
  }
  return +inss.toFixed(2)
}

// ─── IRRF — tabela progressiva mensal ─────────────────────────
const IRRF_BRACKETS = [
  { upTo: 2259.20, rate: 0,     deduct: 0      },
  { upTo: 2826.65, rate: 0.075, deduct: 169.44 },
  { upTo: 3751.05, rate: 0.15,  deduct: 381.44 },
  { upTo: 4664.68, rate: 0.225, deduct: 662.77 },
  { upTo: Infinity,rate: 0.275, deduct: 896.00 },
]
const IRRF_DEPENDENT = 189.59 // dedução por dependente

/**
 * IRRF sobre a base (salário bruto − INSS − deduções de dependentes).
 * @param gross salário bruto
 * @param inss valor já calculado do INSS
 * @param dependents número de dependentes
 */
export function calcIRRF(gross: number, inss: number, dependents = 0): number {
  const base = gross - inss - dependents * IRRF_DEPENDENT
  if (base <= 0) return 0
  const bracket = IRRF_BRACKETS.find(b => base <= b.upTo)!
  const irrf = base * bracket.rate - bracket.deduct
  return Math.max(0, +irrf.toFixed(2))
}

// ─── FGTS — 8% sobre o bruto (depósito do empregador) ─────────
export function calcFGTS(gross: number): number {
  return +(gross * 0.08).toFixed(2)
}

/** Calcula todos os encargos de uma vez. */
export function calcDeductions(gross: number, dependents = 0) {
  const inss = calcINSS(gross)
  const irrf = calcIRRF(gross, inss, dependents)
  const fgts = calcFGTS(gross)
  return { inss, irrf, fgts }
}
