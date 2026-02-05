import React from 'react';
import { connect } from 'react-redux';
import { translate } from '../../base/i18n/functions';
import Watermarks from '../../base/react/components/web/Watermarks';
import RecentList from '../../recent-list/components/RecentList.web';
import { AbstractWelcomePage, IProps, _mapStateToProps } from './AbstractWelcomePage';

// import './WelcomePage.scss';

interface ScheduledExam {
    name: string;
    date: string;
    time: string;
    emails: string;
}

class WelcomePage extends AbstractWelcomePage<IProps> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            ...this.state,
            showScheduleModal: false,
            examName: '',
            examDate: '',
            examTime: '',
            studentEmails: '',
            scheduledExams: [] as ScheduledExam[]
        } as any;
    }

    _onFormSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        this._onJoin();
    };

    _toggleScheduleModal = () => {
        this.setState({
            showScheduleModal: !(this.state as any).showScheduleModal
        } as any);
    };

    /**
     * 🔥 SCHEDULE EXAM + SEND EMAIL
     */
    _scheduleExam = async () => {
        const state: any = this.state;

        if (!state.examName || !state.examDate || !state.examTime || !state.studentEmails) {
            alert('Please fill all fields');
            return;
        }

        const emails = state.studentEmails
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);

        if (emails.length === 0) {
            alert('Please enter at least one email');
            return;
        }

        const meetingUrl = `${window.location.origin}/${state.room || state.examName}`;

        /* 1️⃣ SAVE LOCALLY (UI) */
        const newExam: ScheduledExam = {
            name: state.examName,
            date: state.examDate,
            time: state.examTime,
            emails: state.studentEmails
        };

        this.setState({
            scheduledExams: [...state.scheduledExams, newExam],
            examName: '',
            examDate: '',
            examTime: '',
            studentEmails: '',
            showScheduleModal: false
        } as any);

        /* 2️⃣ SEND EMAIL (BACKEND) */
        try {
            await fetch('http://localhost:5000/send-schedule-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emails,
                    examName: newExam.name,
                    date: newExam.date,
                    time: newExam.time,
                    meetingUrl
                })
            });

            alert('✅ Exam scheduled & email sent to students');
        } catch (err) {
            console.error(err);
            alert('❌ Exam scheduled, but email failed to send');
        }
    };

    render() {
        const state: any = this.state;

        return (
            <div className="welcome dashboard-page" id="welcome_page">

                {/* HEADER */}
                <div className="header">
                    <div className="header-container">
                        <Watermarks />

                        <h1 className="header-text-title">
                            CDAC Proctoring Portal
                        </h1>

                        <p className="header-text-subtitle">
                            Online Examination Portal • Secure Monitoring Enabled
                        </p>

                        {/* JOIN BAR */}
                        <div className="join-meeting-box">
                            <input
                                className="enter-room-input"
                                placeholder="Enter Exam Room Name"
                                value={state.room || ''}
                                onChange={e =>
                                    this.setState({ room: e.target.value } as any)
                                }
                            />

                            <button className="primary-btn" onClick={this._onFormSubmit}>
                                Start Exam
                            </button>

                            <button className="secondary-btn" onClick={this._toggleScheduleModal}>
                                📅 Schedule Exam
                            </button>
                        </div>
                    </div>
                </div>

                {/* DASHBOARD */}
                <div className="dashboard-cards">

                    {/* LEFT : SCHEDULED EXAMS */}
                    <div className="dashboard-card">
                        <h2>Upcoming Scheduled Exams</h2>

                        {state.scheduledExams.length === 0 ? (
                            <div className="empty-state">
                                No exams scheduled yet
                            </div>
                        ) : (
                            <ul className="scheduled-list">
                                {state.scheduledExams.map((exam: ScheduledExam, i: number) => (
                                    <li key={i} className="scheduled-item">
                                        <strong>{exam.name}</strong>
                                        <span>{exam.date} • {exam.time}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* RIGHT : RECENT MEETINGS */}
                    <div className="dashboard-card">
                        <h2>Recent Meeting History</h2>
                        <RecentList />
                    </div>

                </div>

                {/* MODAL */}
                {state.showScheduleModal && (
                    <div className="schedule-modal-overlay">
                        <div className="schedule-modal-content">
                            <h3>Schedule Exam</h3>

                            <input
                                placeholder="Exam Name"
                                value={state.examName}
                                onChange={e =>
                                    this.setState({ examName: e.target.value } as any)
                                }
                            />

                            <input
                                type="date"
                                value={state.examDate}
                                onChange={e =>
                                    this.setState({ examDate: e.target.value } as any)
                                }
                            />

                            <input
                                type="time"
                                value={state.examTime}
                                onChange={e =>
                                    this.setState({ examTime: e.target.value } as any)
                                }
                            />

                            <textarea
                                placeholder="Student emails (comma separated)"
                                value={state.studentEmails}
                                onChange={e =>
                                    this.setState({ studentEmails: e.target.value } as any)
                                }
                            />

                            <div className="modal-actions">
                                <button onClick={this._toggleScheduleModal}>
                                    Cancel
                                </button>
                                <button onClick={this._scheduleExam}>
                                    Schedule
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    }
}

export default translate(connect(_mapStateToProps)(WelcomePage));
