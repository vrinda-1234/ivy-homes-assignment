import { useMemo } from "react";
import { useData } from "../context/DataContext";
import DataLoadingGate from "../components/DataLoadingGate";
import { formatInr, titleCase } from "../utils";

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function InsightsInner() {
  const { listings, projects } = useData();

  const stats = useMemo(() => {
    const active = listings.filter((l) => l.is_live === true);
    const inactive = listings.length - active.length;

    const medianPrice = median(active.map((l) => l.price));
    const medianPpsf = median(active.map((l) => l.price / l.carpet_area).filter(Number.isFinite));

    const byLocality = {};
    for (const l of active) {
      if (!l.locality) continue;
      byLocality[l.locality] = byLocality[l.locality] || { count: 0, prices: [] };
      byLocality[l.locality].count++;
      byLocality[l.locality].prices.push(l.price);
    }
    const localityRows = Object.entries(byLocality)
      .map(([locality, v]) => ({ locality, count: v.count, medianPrice: median(v.prices) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const byBhk = {};
    for (const l of active) {
      byBhk[l.bedroom] = (byBhk[l.bedroom] || 0) + 1;
    }

    return { totalActive: active.length, inactive, medianPrice, medianPpsf, localityRows, byBhk };
  }, [listings]);

  const mismatchedProjects = useMemo(() => {
    const countByProject = {};
    for (const l of listings) {
      if (l.project_id && l.is_live) countByProject[l.project_id] = (countByProject[l.project_id] || 0) + 1;
    }
    return projects.filter((p) => (countByProject[p.project_id] || 0) !== p.total_listings).length;
  }, [listings, projects]);

  return (
    <div>
      <h1>Market insights — Gurgaon</h1>
      <p>Computed live from every retrievable record, not just the documented `/v1/analytics/summary` aggregate.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="num">{stats.totalActive.toLocaleString()}</div>
          <div className="label">Active listings</div>
        </div>
        <div className="stat-card">
          <div className="num">{formatInr(stats.medianPrice)}</div>
          <div className="label">Median asking price</div>
        </div>
        <div className="stat-card">
          <div className="num">{formatInr(stats.medianPpsf)}</div>
          <div className="label">Median ₹/sqft</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.inactive.toLocaleString()}</div>
          <div className="label">Inactive listings the API still returns</div>
        </div>
      </div>

      <h2>By locality</h2>
      <table>
        <thead>
          <tr>
            <th>Locality</th>
            <th>Active listings</th>
            <th>Median price</th>
          </tr>
        </thead>
        <tbody>
          {stats.localityRows.map((r) => (
            <tr key={r.locality}>
              <td>{titleCase(r.locality)}</td>
              <td>{r.count}</td>
              <td>{formatInr(r.medianPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: "2rem" }}>By bedroom count</h2>
      <table>
        <thead>
          <tr>
            <th>Bedrooms</th>
            <th>Active listings</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(stats.byBhk)
            .sort((a, b) => a[0] - b[0])
            .map(([bhk, count]) => (
              <tr key={bhk}>
                <td>{bhk === "0" ? "Plot / studio" : `${bhk} BHK`}</td>
                <td>{count}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: "2rem" }}>What we found in the data</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="num">{stats.inactive}</div>
          <div className="label">Inactive listings returned despite the docs promising active-only</div>
        </div>
        <div className="stat-card">
          <div className="num">{mismatchedProjects}</div>
          <div className="label">Projects where the advertised listing count doesn't match reality</div>
        </div>
      </div>
    </div>
  );
}

export default function Insights() {
  return (
    <DataLoadingGate>
      <InsightsInner />
    </DataLoadingGate>
  );
}
