import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext.jsx"
import { useNavigate } from "react-router-dom"
import api from "../api"
import exportAttendanceXlsx from "../utils/exportAttendanceXlsx"
import "./MeetingsDashboard.css"

const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
  : "—"

const formatDuration = (seconds) => {
  const minutes = Math.max(0, Math.floor((seconds || 0) / 60))
  const hours = Math.floor(minutes / 60)
  const remainderSeconds = Math.max(0, Math.floor(seconds || 0)) % 60
  return hours ? `${hours}h ${minutes % 60}m ${remainderSeconds}s` : minutes ? `${minutes}m ${remainderSeconds}s` : `${remainderSeconds}s`
}

function MeetingsDashboard({ tab }) {
  const { getAccessTokenSilently } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [busyRoomId, setBusyRoomId] = useState("")
  const [attendanceNotice, setAttendanceNotice] = useState("")
  const [isClearingAttendance, setIsClearingAttendance] = useState(false)
  const [attendanceDeleteTarget, setAttendanceDeleteTarget] = useState(null)
  const attendanceRequestVersion = useRef(0)

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const token = await getAccessTokenSilently()
      const response = await api.get("/users/meetings", { headers: { Authorization: `Bearer ${token}` } })
      setMeetings(response.data.meetings || [])
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Could not load your meetings.")
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  useEffect(() => { loadMeetings() }, [loadMeetings, tab])

  const upcoming = meetings.filter((meeting) => meeting.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const teachingHistory = meetings.filter((meeting) => meeting.teachingMode && meeting.status !== "scheduled")
    .filter((meeting) => !meeting.attendanceClearedAt)
    .sort((a, b) => new Date(b.startedAt || b.scheduledAt || b.createdAt) - new Date(a.startedAt || a.scheduledAt || a.createdAt))

  const startScheduledMeeting = async (meeting) => {
    if (new Date(meeting.scheduledAt) > new Date()) return
    setBusyRoomId(meeting.roomId)
    setError("")
    try {
      const token = await getAccessTokenSilently()
      const response = await api.patch(`/users/meetings/${encodeURIComponent(meeting.roomId)}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      navigate(`/meeting/${meeting.roomId}`, { state: { isHost: true, teachingMode: meeting.teachingMode, takeAttendance: meeting.takeAttendance !== false, teachingSource: response.data.meeting.teachingSource, meetingTitle: meeting.title } })
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Could not start this meeting.")
    } finally {
      setBusyRoomId("")
    }
  }

  const openAttendance = async (meeting) => {
    setSelectedMeeting(meeting)
    setReport(null)
    setReportLoading(true)
    setError("")
    try {
      const token = await getAccessTokenSilently()
      const response = await api.get(`/users/meetings/${encodeURIComponent(meeting.roomId)}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setReport(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Could not load the attendance report.")
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedMeeting || selectedMeeting.status !== "live" || tab === "upcoming") return undefined
    let active = true
    const refreshLiveAttendance = async () => {
      const requestVersion = attendanceRequestVersion.current
      try {
        const token = await getAccessTokenSilently()
        const response = await api.get(`/users/meetings/${encodeURIComponent(selectedMeeting.roomId)}/attendance`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!active || requestVersion !== attendanceRequestVersion.current) return
        setReport(response.data)
        setSelectedMeeting((current) => current?.roomId === selectedMeeting.roomId
          ? { ...current, status: response.data.meeting.status }
          : current)
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.msg || "Could not refresh the live attendance report.")
      }
    }
    const interval = setInterval(refreshLiveAttendance, 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [getAccessTokenSilently, selectedMeeting, tab])

  const reportByRoom = async (roomId) => {
    const meeting = teachingHistory.find((item) => item.roomId === roomId)
    if (meeting) await openAttendance(meeting)
  }

  const clearSelectedAttendance = () => {
    if (selectedMeeting) setAttendanceDeleteTarget(selectedMeeting.roomId)
  }

  const clearAllAttendance = () => setAttendanceDeleteTarget("all")

  const confirmDeleteAttendance = async () => {
    if (!attendanceDeleteTarget) return
    attendanceRequestVersion.current += 1
    setIsClearingAttendance(true)
    setError("")
    setAttendanceNotice("")
    try {
      const token = await getAccessTokenSilently()
      if (attendanceDeleteTarget === "all") {
        const response = await api.delete("/users/meetings/attendance", { headers: { Authorization: `Bearer ${token}` } })
        attendanceRequestVersion.current += 1
        setReport(null)
        setSelectedMeeting(null)
        setMeetings((current) => current.map((meeting) => meeting.teachingMode
          ? { ...meeting, studentCount: 0, attendanceClearedAt: new Date().toISOString() }
          : meeting))
        setAttendanceNotice(`Removed attendance reports from ${response.data.clearedSessions} teaching sessions, clearing ${response.data.deletedParticipants} student records and ${response.data.deletedVisits} visits.`)
      } else {
        const response = await api.delete(`/users/meetings/${encodeURIComponent(attendanceDeleteTarget)}/attendance`, { headers: { Authorization: `Bearer ${token}` } })
        attendanceRequestVersion.current += 1
        setReport((current) => current?.meeting.roomId === attendanceDeleteTarget ? null : current)
        setSelectedMeeting((current) => current?.roomId === attendanceDeleteTarget ? null : current)
        setMeetings((current) => current.map((meeting) => meeting.roomId === attendanceDeleteTarget
          ? { ...meeting, studentCount: 0, attendanceClearedAt: new Date().toISOString() }
          : meeting))
        setAttendanceNotice(`Removed this attendance report, clearing ${response.data.deletedParticipants} student records and ${response.data.deletedVisits} visits.`)
      }
      setAttendanceDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.response?.data?.msg || requestError.message || "Could not delete attendance.")
    } finally {
      setIsClearingAttendance(false)
    }
  }

  if (loading) return <section className="meetings-dashboard dashboard-full-panel"><p role="status">Loading your meetings…</p></section>

  return (
    <section className="meetings-dashboard dashboard-full-panel">
      {error && <p className="meetings-error" role="alert">{error}</p>}
      {attendanceNotice && <p className="attendance-notice" role="status">{attendanceNotice}</p>}
      {attendanceDeleteTarget && <div className="attendance-delete-backdrop">
        <section className="attendance-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="attendance-delete-title">
          <span aria-hidden="true">!</span>
          <h2 id="attendance-delete-title">Clear attendance?</h2>
          <p>{attendanceDeleteTarget === "all" ? "This permanently removes every saved attendance record and hides all current attendance reports. It does not delete your class meetings." : `This permanently removes saved attendance for ${selectedMeeting?.title || "this teaching session"} and hides its report until a student attends again.`}</p>
          <div>
            <button type="button" className="attendance-delete-cancel" onClick={() => setAttendanceDeleteTarget(null)} disabled={isClearingAttendance}>Cancel</button>
            <button type="button" className="attendance-delete-confirm" onClick={confirmDeleteAttendance} disabled={isClearingAttendance}>{isClearingAttendance ? "Clearing…" : "Clear attendance"}</button>
          </div>
        </section>
      </div>}
      {tab === "upcoming" ? (
        <div className="upcoming-meetings" aria-label="Scheduled meetings">
          {upcoming.length === 0 ? <div className="meetings-empty"><span aria-hidden="true">▦</span><strong>No meetings scheduled</strong><p>When you schedule a session, it will appear here.</p></div> : upcoming.map((meeting) => {
            const startsAt = new Date(meeting.scheduledAt)
            const ready = startsAt <= new Date()
            return <article className="scheduled-meeting-card" key={meeting.roomId}>
              <div className="scheduled-date"><strong>{new Intl.DateTimeFormat(undefined, { month: "short" }).format(startsAt)}</strong><b>{startsAt.getDate()}</b><span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(startsAt)}</span></div>
              <div className="scheduled-details"><div className="scheduled-title-row"><h2>{meeting.title}</h2>{meeting.teachingMode && <span className="meeting-type-pill">Teaching</span>}</div><p>{formatDate(meeting.scheduledAt)}</p><small>Room {meeting.roomId.slice(0, 8)}</small></div>
              <button type="button" className="scheduled-start-button" disabled={!ready || busyRoomId === meeting.roomId} onClick={() => startScheduledMeeting(meeting)}>{busyRoomId === meeting.roomId ? "Starting…" : ready ? "Start meeting" : "Not yet"}</button>
            </article>
          })}
        </div>
      ) : (
        <div className="attendance-layout">
          <div className="attendance-meeting-list">
            <div className="attendance-list-heading"><strong>Teaching sessions</strong><span>{teachingHistory.length}</span><button type="button" className="attendance-clear-all" onClick={clearAllAttendance} disabled={isClearingAttendance}>Clear all attendance</button></div>
            {teachingHistory.length === 0 ? <div className="meetings-empty compact"><strong>No class reports yet</strong><p>Attendance reports will appear after students join a teaching session.</p></div> : teachingHistory.map((meeting) => (
              <button type="button" key={meeting.roomId} className={`attendance-meeting-item${selectedMeeting?.roomId === meeting.roomId ? " is-selected" : ""}`} onClick={() => openAttendance(meeting)}>
                <strong>{meeting.title}</strong><span>{formatDate(meeting.startedAt || meeting.scheduledAt || meeting.createdAt)}</span><small>{meeting.studentCount || 0} students · {meeting.status === "live" ? "In progress" : "Ended"}</small>
              </button>
            ))}
          </div>

          <div className="attendance-report">
            {!selectedMeeting ? <div className="meetings-empty"><span aria-hidden="true">✓</span><strong>Select a class session</strong><p>Choose a session to see its student attendance.</p></div> : reportLoading ? <p role="status">Loading attendance…</p> : report && <>
              <div className="attendance-report-heading">
                <div><span className="host-setup-eyebrow">ATTENDANCE REPORT</span><h2>{report.meeting.title}</h2><p>{formatDate(report.meeting.startedAt || report.meeting.scheduledAt)}{report.meeting.status === "live" ? " · In progress" : " · Ended"}</p></div>
                <div className="attendance-report-actions">
                <button type="button" className="attendance-delete-button" onClick={clearSelectedAttendance} disabled={isClearingAttendance}>Delete attendance</button>
                <button type="button" className="attendance-export-button" onClick={() => exportAttendanceXlsx(report)} disabled={!report.sessions.length}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg> Download Excel
                </button>
                </div>
              </div>
              <div className="attendance-summary">
                <div><span>Students attended</span><strong>{report.studentCount}</strong></div>
                <div><span>Call joins</span><strong>{report.sessionCount}</strong></div>
                <div><span>Longest student total</span><strong>{formatDuration(report.sessions.reduce((longest, session) => Math.max(longest, session.totalDurationSeconds || 0), 0))}</strong></div>
              </div>
              <div className="attendance-table-wrap">
                <table className="attendance-table">
                  <thead><tr><th>Student</th><th>Login time</th><th>Logout time</th><th>This visit</th><th>Total class time</th><th>Visits</th><th>Status</th></tr></thead>
                  <tbody>{report.sessions.length === 0 ? <tr><td colSpan="7" className="attendance-table-empty">No students have joined this session yet.</td></tr> : report.sessions.map((session, index) => <tr key={`${session.email}-${session.joinedAt}-${index}`}>
                    <td><strong>{session.studentName}</strong>{session.email && <small>{session.email}</small>}</td>
                    <td>{formatDate(session.joinedAt)}</td><td>{session.leftAt ? formatDate(session.leftAt) : "Still in class"}</td><td>{formatDuration(session.durationSeconds)}</td><td>{formatDuration(session.totalDurationSeconds)}</td><td>{session.joinCount}</td>
                    <td><span className={`attendance-status${session.leftAt ? " is-left" : " is-present"}`}>{session.leftAt ? "Logged out" : "Present"}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <p className="attendance-note">Each row records one visit. Total class time adds all visits for that student; an active visit’s duration updates while the class is in progress.</p>
            </>}
          </div>
        </div>
      )}
    </section>
  )
}

export default MeetingsDashboard
