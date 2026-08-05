import { AlertIcon, RefreshIcon } from "./Icons";

export function LoadingPanel({
  label = "Loading package data",
}: {
  label?: string;
}) {
  return (
    <div className="state-panel" role="status">
      <div className="spinner" />
      <div>
        <strong>{label}</strong>
        <p>Fetching the latest data from qpackages.com.</p>
      </div>
    </div>
  );
}

export function ErrorPanel({
  title = "Unable to load data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="state-panel state-panel-error" role="alert">
      <span className="state-icon">
        <AlertIcon />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        <button
          className="button button-secondary"
          type="button"
          onClick={onRetry}
        >
          <RefreshIcon />
          Try again
        </button>
      </div>
    </div>
  );
}
