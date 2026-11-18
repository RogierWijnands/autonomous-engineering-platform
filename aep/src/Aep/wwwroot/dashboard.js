"use strict";

const login = document.getElementById("login");
const tokenInput = document.getElementById("token");
const connection = document.getElementById("connection");
const dashboard = document.getElementById("dashboard");
const groups = {
  queued: document.getElementById("queued"),
  active: document.getElementById("active"),
  finished: document.getElementById("finished"),
};
let token = "";
let timer;
let generation = 0;
let lastSnapshot = "";

function setConnection(message) {
  if (connection.textContent !== message) connection.textContent = message;
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function render(workflows) {
  Object.values(groups).forEach((group) => group.replaceChildren());
  for (const workflow of workflows) {
    const category =
      workflow.status === "Running"
        ? "active"
        : ["Completed", "Failed", "Cancelled"].includes(workflow.status)
          ? "finished"
          : "queued";
    const card = document.createElement("article");
    card.append(element("h3", `${workflow.issueKey}: ${workflow.summary}`));
    card.append(
      element(
        "p",
        `Status: ${workflow.status} | Repository: ${workflow.repository}`,
      ),
    );
    card.append(element("h4", "Agent steps"));
    const steps = document.createElement("ol");
    for (const step of workflow.steps)
      steps.append(element("li", `${step.name}: ${step.status}`));
    card.append(steps, element("h4", "Workflow events"));
    const events = document.createElement("ul");
    events.setAttribute("role", "log");
    events.setAttribute(
      "aria-label",
      `Workflow events for ${workflow.issueKey}`,
    );
    for (const event of workflow.events)
      events.append(element("li", `${event.occurredAt}: ${event.eventType}`));
    if (!workflow.events.length)
      events.append(element("li", "No events recorded."));
    card.append(events);
    groups[category].append(card);
  }
  Object.values(groups).forEach((group) => {
    if (!group.hasChildNodes()) group.append(element("p", "No workflows."));
  });
}

async function refresh(currentGeneration) {
  try {
    const response = await fetch("/api/workflows", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (currentGeneration !== generation) return;
    if (response.status === 401 || response.status === 503) {
      token = "";
      lastSnapshot = "";
      dashboard.hidden = true;
      login.hidden = false;
      setConnection(
        response.status === 401
          ? "Authentication failed. Check the dashboard token."
          : "Dashboard authentication is not configured on the server.",
      );
      tokenInput.focus();
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const workflows = await response.json();
    if (currentGeneration !== generation) return;
    const snapshot = JSON.stringify(workflows);
    const changed = snapshot !== lastSnapshot;
    if (changed) {
      render(workflows);
      lastSnapshot = snapshot;
    }
    const connecting = dashboard.hidden;
    dashboard.hidden = false;
    login.hidden = true;
    if (connecting) document.getElementById("disconnect").focus();
    if (changed && !connecting)
      setConnection(
        `Connected. Workflow data updated at ${new Date().toLocaleTimeString()}.`,
      );
    else if (!connection.textContent.startsWith("Connected."))
      setConnection("Connected. Workflow data is up to date.");
  } catch {
    if (currentGeneration !== generation) return;
    setConnection("Connection lost. Displayed data may be outdated; retrying.");
  }
  timer = setTimeout(() => refresh(currentGeneration), 3000);
}

login.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(timer);
  generation++;
  token = tokenInput.value;
  tokenInput.value = "";
  setConnection("Connecting...");
  void refresh(generation);
});
document.getElementById("disconnect").addEventListener("click", () => {
  generation++;
  clearTimeout(timer);
  token = "";
  lastSnapshot = "";
  dashboard.hidden = true;
  login.hidden = false;
  Object.values(groups).forEach((group) => group.replaceChildren());
  setConnection("Disconnected.");
  tokenInput.focus();
});
