import "../styles/Sidebar.scss";

function Sidebar({ sessions, activeSession, onSelectSession, onCreateSession, onDeleteSession }) {
  return (
    <div className="sidebar">
      <h2 className="sidebar__title">Sessions</h2>
      <button className="sidebar__new-session" onClick={onCreateSession}>
        <span className="sidebar__new-session-icon">+</span>
        New Session
      </button>
      <ul className="sidebar__list">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`sidebar__item ${activeSession === s.id ? "sidebar__item--active" : ""}`}
            onClick={() => onSelectSession(s.id)}
          >
            <span>{s.name || `Session ${s.id}`}</span>
            <button
              className="sidebar__delete"
              onClick={(e) => {
                e.stopPropagation(); // prevent session select
                onDeleteSession?.(s.id); // delegate to App.jsx
              }}
            >
              ❌
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
