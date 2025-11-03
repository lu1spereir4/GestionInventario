import './SummaryCard.css';

function SummaryCard({ title, value, icon }) {
  return (
    <div className="summary-card">
      <div className="summary-icon">{icon}</div>
      <div className="summary-content">
        <div className="summary-title">{title}</div>
        <div className="summary-value">{value}</div>
      </div>
    </div>
  );
}

export default SummaryCard;
