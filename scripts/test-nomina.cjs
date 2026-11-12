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

// Anticipos por semana: cuatro celdas que suman el total; compatibilidad con el total único histórico.
assert.equal(n.anticipoSemanas(pago), null, "sin semanas informadas usa el total único");
assert.equal(n.totalAnticipos({ ...pago, AnticiposBs: 1000 }), 1000, "total único histórico");
const semanas = n.anticipoSemanas({ ...pago, AnticipoS1: 100, AnticipoS3: 50 });
assert.equal(semanas && semanas.join(","), "100,0,50,0", "semanas vacías cuentan como 0");
assert.equal(n.totalAnticipos({ ...pago, AnticiposBs: 999, AnticipoS1: 100, AnticipoS2: 20, AnticipoS4: 5 }), 125, "las semanas sustituyen al total único");
const conSemanas = n.calcNomina({ ...pago, Periodo: "2026-10", AnticipoS1: 100, AnticipoS2: 100, AnticipoS3: 100, AnticipoS4: 100 });
assert.equal(conSemanas.anticiposBs, 400);
assert.equal(conSemanas.netoBs, 690 - 400, "el neto descuenta la suma semanal");
const semanalVacio = n.calcNomina({ ...pago, AnticipoS1: 0, AnticipoS2: 0, AnticipoS3: 0, AnticipoS4: 0 });
assert.equal(semanalVacio.anticiposBs, 0, "semanas en cero equivalen a sin anticipos");

console.log("NÓMINA PASS: topes, suma 100 %, cálculo sobre Talento Humano, anticipos semanales y compatibilidad histórica.");
