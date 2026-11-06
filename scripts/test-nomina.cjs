const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const context = { exports: {}, require, Date, Intl, console, Object, Number, Math, JSON };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/nomina.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);

const n = context.exports;
assert.equal(n.totalDistribucion(n.PAGOS_DEFAULTS), 1);
assert.equal(n.validarDistribucion(n.PAGOS_DEFAULTS), "");
assert(n.opcionesPorcentaje(0.1).includes(0.08));
assert(n.opcionesPorcentaje(0.02).includes(0.015));
assert.match(n.validarDistribucion({ ...n.PAGOS_DEFAULTS, PctDisp: 0.105 }), /0 % y 10%/);
assert.match(n.validarDistribucion({ ...n.PAGOS_DEFAULTS, PctRepr: 0.01 }), /101/);

const pago = {
  ...n.PAGOS_DEFAULTS,
  Periodo: "2026-10", Cedula: "123", TasaBCV: 1, SalarioIntegralUSD: 690,
  PctIVSS: 0, PctParo: 0, PctFAOV: 0, PctISLR: 0,
};
const calc = n.calcNomina(pago);
assert.equal(calc.totalA + calc.totalB + calc.totalC, 690);
assert.equal(calc.netoUsd, 690);

const legacy = n.calcNomina({
  Periodo: "2026-09", Cedula: "123", TasaBCV: 1, SalarioIntegralUSD: 100,
  PctSueldo: 0.2, PctDisp: 0, PctResp: 0, PctRepr: 0, PctAntig: 0,
  BonoLimpieza: 5, BonoPuntual: 2, BonoMovilidad: 5, BonoCoordin: 15, BonoProductiv: 3,
  PctCestaticket: 0, PctIVSS: 0, PctParo: 0, PctFAOV: 0, PctISLR: 0,
});
assert.equal(legacy.totalB, 30);

console.log("NÓMINA PASS: topes, suma 100 %, cálculo sobre Talento Humano y compatibilidad histórica.");
