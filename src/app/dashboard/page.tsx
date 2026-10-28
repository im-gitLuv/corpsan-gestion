"use client";

/** Resumen general: KPIs del personal activo, distribución por tipo de nómina y cumpleaños del mes. */
import { useData } from "@/lib/store";
import { Ic, Icons } from "@/components/icons";

const MES = new Date().getMonth(); // 0-11

export default function Resumen() {
  const { activos } = useData();

  const totalActivo = activos.length;
  const nominaMensual = activos.reduce((s, e) => s + (Number(e.sueldoMensual) || 0), 0);
  const bonos = activos.reduce((s, e) => s + (Number(e.bonoAlimentacion) || 0), 0);

  const conDocs = activos.filter((e) => {
    const doc = ["cedulaFisco", "cvFisco", "medicoFisco", "licenciaFisco", "rifFisco", "certFisco"];
    return doc.every((k) => ["SI", "NO APLICA"].includes(String(e[k] ?? "").toUpperCase()));
  }).length;

  const kpis: [string, string | number][] = [
    ["Personal activo", totalActivo],
    ["Nómina mensual", fmtUsd(nominaMensual)],
    ["Bono alimentación", fmtUsd(bonos)],
    ["Expediente físico completo", `${conDocs} / ${totalActivo}`],
  ];

  // distribución por tipo de nómina
  const porNomina: Record<string, number> = {};
  activos.forEach((e) => {
    const k = String(e.tipoNomina || "SIN DEFINIR").toUpperCase();
    porNomina[k] = (porNomina[k] || 0) + 1;
  });
  const maxNomina = Math.max(1, ...Object.values(porNomina));

  // cumpleaños del mes actual
  const cumples = activos
    .filter((e) => {
      const d = String(e.fechaNac || "");
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      return m && Number(m[2]) - 1 === MES;
    })
    .map((e) => ({ nombre: e.nombre, dia: Number(String(e.fechaNac).slice(8, 10)) }))
    .sort((a, b) => a.dia - b.dia);

  return (
    <div>
      <div className="cards">
        {kpis.map(([label, val]) => (
          <div className="card-kpi" key={label}>
            <small>{label}</small>
            <strong>{val}</strong>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Personal por tipo de nómina</h3>
        {Object.entries(porNomina).length === 0 && <p className="empty">Sin datos para mostrar</p>}
        {Object.entries(porNomina).map(([k, v]) => (
          <div className="bar-row" key={k}>
            <span className="bar-label">{k}</span>
            <div className="bar-track"><div className="bar" style={{ width: Math.round((v / maxNomina) * 100) + "%" }}></div></div>
            <span className="bar-val">{v}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Ic d={Icons.cake} /> Cumpleaños de {nombreMes(MES)}
        </h3>
        {cumples.length === 0 ? (
          <p className="empty">Ningún cumpleaños este mes</p>
        ) : (
          <ul className="cumples">
            {cumples.map((c) => (
              <li key={c.nombre}><b>{c.nombre}</b><span>día {c.dia}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

function nombreMes(m: number): string {
  return ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m];
}
