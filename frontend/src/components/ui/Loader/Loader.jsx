export function Loader({ label = "Loading..." }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
