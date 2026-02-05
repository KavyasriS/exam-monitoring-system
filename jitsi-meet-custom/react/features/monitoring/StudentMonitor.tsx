/* eslint-disable */
import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { getCurrentConference } from "../base/conference/functions";
import { isLocalParticipantModerator } from "../base/participants/functions";
import { FaceDetector, FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const StudentMonitor = () => {
  const conference = useSelector(getCurrentConference);
  const isModerator = useSelector(isLocalParticipantModerator);

  const detectorRef = useRef<any>(null);
  const landmarkerRef = useRef<any>(null);
  const startedRef = useRef(false);

  const currentFaceViolation = useRef<string | null>(null);
  const isTabViolationActive = useRef(false);
  const isSidebarViolationActive = useRef(false);
  const isPoseViolationActive = useRef(false);

  /* =====================================================
   * 🧑‍⚖️ MODERATOR SIDE (Receive Only)
   * ===================================================== */
  useEffect(() => {
    if (!conference || !isModerator) return;

    const handler = (event: any) => {
      const { participantId, reason, status, type } = event.attributes;
      if (participantId === conference.myUserId()) return;

      const alertId = `${type}-${participantId}`;
      let alertBox = document.getElementById(alertId);

      if (status === "resolved") {
        alertBox?.remove();
        return;
      }

      if (!alertBox) {
        const container =
          document.getElementById("proctor-alert-container") ||
          (() => {
            const c = document.createElement("div");
            c.id = "proctor-alert-container";
            c.style.cssText =
              "position:fixed; top:20px; right:20px; z-index:9999;";
            document.body.appendChild(c);
            return c;
          })();

        alertBox = document.createElement("div");
        alertBox.id = alertId;
        alertBox.style.cssText =
          "background:#d32f2f; color:#fff; padding:12px 18px; margin-bottom:8px; border-radius:8px; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); border-left: 5px solid gold;";
        container.appendChild(alertBox);
      }

      alertBox.innerHTML = `🚨 ${reason}<br/><small>Student: ${participantId}</small>`;
    };

    conference.addCommandListener("PROCTOR_STATUS_CHANGE", handler);
    return () =>
      conference.removeCommandListener("PROCTOR_STATUS_CHANGE", handler);
  }, [conference, isModerator]);

  /* =====================================================
   * 🎥 STUDENT SIDE (AI ENGINE)
   * ===================================================== */
  useEffect(() => {
    if (isModerator || !conference || startedRef.current) return;
    startedRef.current = true;

    /* ---------- ENVIRONMENT CHECKS ---------- */
    const checkSidebar = () => {
      const isSmall = window.innerWidth < window.screen.width * 0.85;
      if (isSmall && !isSidebarViolationActive.current) {
        isSidebarViolationActive.current = true;
        conference.sendCommand("PROCTOR_STATUS_CHANGE", {
          attributes: {
            participantId: conference.myUserId(),
            reason: "SIDEBAR DETECTED",
            status: "active",
            type: "sidebar"
          }
        });
      } else if (!isSmall && isSidebarViolationActive.current) {
        isSidebarViolationActive.current = false;
        conference.sendCommand("PROCTOR_STATUS_CHANGE", {
          attributes: {
            participantId: conference.myUserId(),
            status: "resolved",
            type: "sidebar"
          }
        });
      }
    };

    const handleVisibility = () => {
      if (document.hidden && !isTabViolationActive.current) {
        isTabViolationActive.current = true;
        conference.sendCommand("PROCTOR_STATUS_CHANGE", {
          attributes: {
            participantId: conference.myUserId(),
            reason: "TAB SWITCHED",
            status: "active",
            type: "tab"
          }
        });
      } else if (!document.hidden && isTabViolationActive.current) {
        isTabViolationActive.current = false;
        conference.sendCommand("PROCTOR_STATUS_CHANGE", {
          attributes: {
            participantId: conference.myUserId(),
            status: "resolved",
            type: "tab"
          }
        });
      }
    };

    window.addEventListener("resize", checkSidebar);
    document.addEventListener("visibilitychange", handleVisibility);

    /* ---------- AI INIT ---------- */
    const initAI = async () => {
      try {
        await new Promise(r => setTimeout(r, 8000));

        const vision = await FilesetResolver.forVisionTasks("/static/wasm");

        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/static/models/face_detector.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.8
        });

        landmarkerRef.current = await FaceLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: "/static/models/face_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
          }
        );

        const detectLoop = () => {
          if (isModerator || !detectorRef.current) return;

          const video = document.querySelector("video");
          if (!video || video.videoWidth === 0 || video.paused)
            return requestAnimationFrame(detectLoop);

          const now = Date.now();
          const faceRes = detectorRef.current.detectForVideo(video, now);
          const faces = faceRes.detections.length;

          /* ---- FACE COUNT VIOLATIONS ---- */
          let newFaceViolation =
            faces === 0
              ? "FACE ABSENT"
              : faces >= 2
              ? "MULTIPLE FACES"
              : null;

          if (newFaceViolation !== currentFaceViolation.current) {
            conference.sendCommand("PROCTOR_STATUS_CHANGE", {
              attributes: {
                participantId: conference.myUserId(),
                reason: newFaceViolation,
                status: newFaceViolation ? "active" : "resolved",
                type: "face"
              }
            });
            currentFaceViolation.current = newFaceViolation;
          }

          /* ---- HEAD POSE (ONLY IF EXACTLY 1 FACE) ---- */
          if (faces === 1) {
            const lmRes =
              landmarkerRef.current.detectForVideo(video, now);

            if (lmRes.faceLandmarks?.length) {
              const pts = lmRes.faceLandmarks[0];
              const nose = pts[1];
              const leftEye = pts[33];
              const rightEye = pts[263];

              const yaw =
                (nose.x - leftEye.x) /
                (rightEye.x - leftEye.x);

              const lookingAway = yaw < 0.42 || yaw > 0.58;

              if (lookingAway && !isPoseViolationActive.current) {
                isPoseViolationActive.current = true;
                conference.sendCommand("PROCTOR_STATUS_CHANGE", {
                  attributes: {
                    participantId: conference.myUserId(),
                    reason: "LOOKING AWAY",
                    status: "active",
                    type: "pose"
                  }
                });
              } else if (
                !lookingAway &&
                isPoseViolationActive.current
              ) {
                isPoseViolationActive.current = false;
                conference.sendCommand("PROCTOR_STATUS_CHANGE", {
                  attributes: {
                    participantId: conference.myUserId(),
                    status: "resolved",
                    type: "pose"
                  }
                });
              }
            }
          } else if (isPoseViolationActive.current) {
            // Clear pose if face count changes
            isPoseViolationActive.current = false;
            conference.sendCommand("PROCTOR_STATUS_CHANGE", {
              attributes: {
                participantId: conference.myUserId(),
                status: "resolved",
                type: "pose"
              }
            });
          }

          requestAnimationFrame(detectLoop);
        };

        detectLoop();
      } catch (e) {
        console.error(e);
      }
    };

    initAI();

    return () => {
      window.removeEventListener("resize", checkSidebar);
      document.removeEventListener("visibilitychange", handleVisibility);
      detectorRef.current?.close();
      landmarkerRef.current?.close();
    };
  }, [conference, isModerator]);

  return null;
};

export default StudentMonitor;
