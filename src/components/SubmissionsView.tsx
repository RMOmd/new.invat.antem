import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Clock, MessageSquare, Send, Award, User } from 'lucide-react';

export const SubmissionsView: React.FC = () => {
  const { currentUser, allSubmissions, reviewSubmission } = useAuth();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(10);
  const [feedbackInput, setFeedbackInput] = useState('');

  const isTeacher = currentUser?.role === 'teacher';

  // If student, filter by their own submissions; if teacher, show all
  const visibleSubmissions = isTeacher
    ? allSubmissions
    : allSubmissions.filter(s => s.userId === currentUser?.id);

  const handleReview = (subId: string) => {
    reviewSubmission(subId, Number(gradeInput), feedbackInput);
    setSelectedSubId(null);
    setFeedbackInput('');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isTeacher ? 'Verificarea temelor (Panoul Profesorului)' : 'Temele mele trimise spre verificare'}
          </h1>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isTeacher ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {isTeacher ? 'Profesor' : 'Student'}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {isTeacher
            ? 'Aici puteți citi răspunsurile scrise ale tuturor studenților, acorda note și lăsa comentarii.'
            : 'Aici vedeți stadiul lucrărilor trimise, nota acordată și comentariile profesorului.'}
        </p>
      </div>

      {visibleSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Nu există teme trimise încă</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Pentru a trimite o compunere sau un dialog la verificare, deschideți orice exercițiu din curs și folosiți blocul «Trimiteți tema profesorului».
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleSubmissions.map(sub => {
            const isReviewed = sub.status === 'reviewed';

            return (
              <div
                key={sub.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">
                        #{sub.activityId}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(sub.createdAt).toLocaleString()}
                      </span>
                      {isTeacher && (
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> {sub.userName} ({sub.userEmail})
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {sub.activityTitle}
                    </h3>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full shrink-0 w-fit ${
                    isReviewed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isReviewed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {isReviewed ? `Verificat • Nota ${sub.grade}/10` : 'În așteptare'}
                  </span>
                </div>

                {/* Student's answer */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 mb-3 whitespace-pre-wrap">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Răspunsul studentului:</span>
                  {sub.submissionText}
                </div>

                {/* Teacher feedback if reviewed */}
                {isReviewed && sub.teacherFeedback && (
                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-sm text-emerald-900 mb-2">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mb-1">
                      <Award className="w-3.5 h-3.5" /> Comentariul profesorului:
                    </span>
                    {sub.teacherFeedback}
                  </div>
                )}

                {/* Teacher evaluation form */}
                {isTeacher && !isReviewed && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {selectedSubId === sub.id ? (
                      <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-bold text-purple-900">Nota (1 - 10):</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={gradeInput}
                            onChange={e => setGradeInput(Number(e.target.value))}
                            className="w-20 px-3 py-1.5 text-sm bg-white border border-purple-300 rounded-lg text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-purple-900 block mb-1">Feedback și corecturi:</label>
                          <textarea
                            rows={3}
                            value={feedbackInput}
                            onChange={e => setFeedbackInput(e.target.value)}
                            placeholder="Bravo! Greșeli observate: ..."
                            className="w-full text-sm p-2.5 bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(sub.id)}
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Salvează evaluarea
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSubId(null)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                          >
                            Anulează
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubId(sub.id);
                          setGradeInput(10);
                          setFeedbackInput('');
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs"
                      >
                        Verifică această lucrare
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

