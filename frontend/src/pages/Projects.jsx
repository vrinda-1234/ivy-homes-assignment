import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import DataLoadingGate from "../components/DataLoadingGate";
import { formatCrore, titleCase } from "../utils";

const PAGE_SIZE = 20;

// price_min/price_max are documented as plain rupees but are actually
// crore-scale figures (see findings) — we scale them for display.
const CRORE = 1e7;

function ProjectsInner() {
  const { projects } = useData();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const statuses = useMemo(() => [...new Set(projects.map((p) => p.project_status))].filter(Boolean), [projects]);

  const filtered = useMemo(() => {
    let rows = projects;
    if (status) rows = rows.filter((p) => p.project_status === status);
    return rows;
  }, [projects, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <h1>Builder projects</h1>
      <div className="filters-bar">
        <div>
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="result-count">{filtered.length.toLocaleString()} projects</div>

      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Locality</th>
            <th>Status</th>
            <th>Price range</th>
            <th>Units</th>
            <th>Possession</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((p) => (
            <tr key={p.project_id}>
              <td>
                {p.apartment_name}
                <div style={{ color: "var(--ink-soft)", fontSize: "0.8rem" }}>{p.developer_name}</div>
              </td>
              <td>{titleCase(p.locality)}</td>
              <td>{titleCase(p.project_status)}</td>
              <td>
                {formatCrore(p.price_min * CRORE)} – {formatCrore(p.price_max * CRORE)}
              </td>
              <td>{p.total_units}</td>
              <td>{p.possession_date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  return (
    <DataLoadingGate>
      <ProjectsInner />
    </DataLoadingGate>
  );
}
