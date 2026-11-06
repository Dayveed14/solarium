import { kwh, naira } from '../../lib/format.js';

// What only a site visit adds to an energy result: the three sizes, whether the roof is big enough, and the real fuel bill.
export default function AuditExtras({ result }) {
  const a = result?.audit;
  if (!a) return null;
  const { roof, fuel, scenarios } = a;
  return (
    <section className="r-card" aria-labelledby="audit-extras">
      <p className="eyebrow">From the site visit</p>
      <h2 id="audit-extras">Sizes, roof and fuel</h2>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Size</th><th>Energy a day</th><th>Panels</th><th>Battery</th><th>Inverter</th><th>About</th></tr></thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.key} className={s.key === 'full' ? 'row-strong' : ''}>
                <td>{s.label}</td><td>{kwh(s.kwhPerDay)} kWh</td><td>{s.kwp} kWp</td><td>{s.batteryKwh} kWh</td><td>{s.inverterKva} kVA</td><td>{naira(s.systemCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="plain-list">
        {roof.areaM2 > 0 ? (
          <li className={roof.fits === false ? 'warn-line' : ''}>
            Roof: {roof.areaM2} m² measured. The recommended system needs about {roof.neededM2} m²
            {roof.fits === false ? <> , so the roof fits about {roof.maxKwp} kWp. Part of the system may need another space, such as a car park or an adjoining roof.</> : <>, so it fits.</>}
          </li>
        ) : <li>Roof area was not measured.</li>}
        {fuel.reportedMonthly ? <li>Generator fuel: you told the agent you spend about {naira(fuel.reportedMonthly)} a month. Our estimate for this load is {naira(fuel.modelledGeneratorMonthly)} a month.</li> : null}
        <li>{a.eaasEligible ? 'This site uses enough energy to be offered energy as a service.' : `Energy as a service is offered from ${a.eaasMinKwhPerDay} kWh a day. You can still buy, lease or rent.`}</li>
      </ul>
    </section>
  );
}
