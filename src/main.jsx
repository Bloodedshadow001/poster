import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../styles.css";

const LOGO_SRC = "/assets/parasara-logo.jpg";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="login-shell">
          <section className="login-panel glass">
            <div className="brand-lockup large">
              <img className="brand-logo" src={LOGO_SRC} alt="Parasara Media Marketplace" />
            </div>
            <div className="login-copy">
              <h1>Parasara could not start</h1>
              <p>{this.state.error.message}</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
