import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useDropzone } from "react-dropzone";
import MapView from "./components/MapView";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "";

// ── helpers ──────────────────────────────────────────────────────────────────
const gradeColor = (g) =>
  g === 1 ? "#16a34a" : g === 2 ? "#d97706" : "#dc2626";
const gradeIcon  = (g) => (g === 1 ? "🏅" : g === 2 ? "🟡" : "🔴");

export default function App() {
  // location state
  const [locationInput, setLocationInput] = useState("");
  const [locData,       setLocData]       = useState(null); // {lat,lon,display_name,soil,elevation,weather,climate}
  const [locLoading,    setLocLoading]    = useState(false);
  const [locError,      setLocError]      = useState("");

  // image analysis state
  const [imageFile,     setImageFile]     = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [analysisResult,setAnalysisResult]= useState(null);
  const [analysisLoading,setAnalysisLoading]=useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // crop plan state
  const [sowingDate,    setSowingDate]    = useState("");
  const [planResult,    setPlanResult]    = useState(null);
  const [planLoading,   setPlanLoading]   = useState(false);
  const [planError,     setPlanError]     = useState("");

  // active tab
  const [activeTab, setActiveTab] = useState("analysis");

  // ── Load Location ───────────────────────────────────────────────────────────
  const loadLocation = async () => {
    if (!locationInput.trim()) return;
    setLocLoading(true);
    setLocError("");
    setLocData(null);
    setAnalysisResult(null);
    setPlanResult(null);

    try {
      // 1. Geocode + soil
      const geoRes = await fetch(
        `${API}/api/geocode?location=${encodeURIComponent(locationInput)}`
      );
      const geo = await geoRes.json();
      if (!geo.success) throw new Error(geo.error);

      // 2. Weather
      const wxRes = await fetch(`${API}/api/weather?lat=${geo.lat}&lon=${geo.lon}`);
      const wx    = await wxRes.json();

      // 3. Climate (10yr)
      const climRes = await fetch(`${API}/api/climate?lat=${geo.lat}&lon=${geo.lon}`);
      const clim    = await climRes.json();

      setLocData({
        name:         locationInput,
        display_name: geo.display_name,
        lat:          geo.lat,
        lon:          geo.lon,
        soil:         geo.soil,
        elevation:    clim.elevation,
        weather:      wx,
        climate:      clim,
      });
    } catch (e) {
      setLocError(e.message || "Could not load location. Try adding state name.");
    } finally {
      setLocLoading(false);
    }
  };

  // ── Image Drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((files) => {
    if (files[0]) {
      setImageFile(files[0]);
      setImagePreview(URL.createObjectURL(files[0]));
      setAnalysisResult(null);
      setAnalysisError("");
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [".jpg", ".jpeg", ".png"] }, maxFiles: 1,
  });

  // ── Analyse Image ───────────────────────────────────────────────────────────
  const analyseImage = async () => {
    if (!imageFile || !locData) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);

    try {
      const form = new FormData();
      form.append("image",    imageFile);
      form.append("location", locData.name);
      form.append("lat",      locData.lat);
      form.append("lon",      locData.lon);
      form.append("soil",     JSON.stringify(locData.soil));

      const res  = await fetch(`${API}/api/predict`, { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAnalysisResult(data);
    } catch (e) {
      setAnalysisError(e.message || "Analysis failed. Please try again.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ── Generate Crop Plan ──────────────────────────────────────────────────────
  const generatePlan = async () => {
    if (!sowingDate || !locData) return;
    setPlanLoading(true);
    setPlanError("");
    setPlanResult(null);

    try {
      const res = await fetch(`${API}/api/crop-plan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          location:    locData.name,
          sowing_date: sowingDate,
          lat:         locData.lat,
          lon:         locData.lon,
          soil:        locData.soil,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPlanResult(data);
    } catch (e) {
      setPlanError(e.message || "Plan generation failed.");
    } finally {
      setPlanLoading(false);
    }
  };

  // ── Download Report ─────────────────────────────────────────────────────────
//   const downloadReport = (content, filename) => {
//     const now  = new Date().toLocaleString("en-IN");
//     const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
// <title>${filename}</title>
// <style>
//   body { font-family: 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
//   h1 { color: #14532d; border-bottom: 3px solid #dcfce7; padding-bottom: 12px; }
//   h2, h3 { color: #166534; }
//   p { line-height: 1.8; }
//   ul, ol { line-height: 1.8; }
//   .header { background: linear-gradient(135deg,#14532d,#166534); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
//   .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
//   @media print { .header { -webkit-print-color-adjust: exact; } }
// </style></head><body>
// <div class="header">
//   <h1 style="color:white;border:none;margin:0">🌾 Pur Ferme Report</h1>
//   <p style="margin:4px 0;opacity:.85">Location: ${locData?.name || ""} | Generated: ${now}</p>
// </div>
// ${content}
// <div class="footer"><p>Pur Ferme Traceability System | Advisory only — validate with local agronomist</p></div>
// </body></html>`;
//     const blob = new Blob([html], { type: "text/html" });
//     const url  = URL.createObjectURL(blob);
//     const a    = document.createElement("a");
//     a.href = url; a.download = filename + ".html"; a.click();
//     URL.revokeObjectURL(url);
//   };

//   const downloadReport = async (content, filename, type) => {
//   try {
//     const res = await fetch(`${API}/api/generate-pdf`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         content,
//         filename,
//         type,
//         location: locData?.name || "",
//         result: type === "analysis" ? analysisResult : planResult,
//         sowing_date: sowingDate,
//       }),
//     });
//     const blob = await res.blob();
//     const url  = URL.createObjectURL(blob);
//     const a    = document.createElement("a");
//     a.href = url;
//     a.download = filename + ".pdf";
//     a.click();
//     URL.revokeObjectURL(url);
//   } catch (e) {
//     alert("PDF generation failed: " + e.message);
//   }
// };
  const downloadReport = async (content, filename, type, resultData) => {
  try {
    const res = await fetch(`${API}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        filename,
        type,
        location:    locData?.name || "",
        result:      resultData,
        sowing_date: sowingDate,
      }),
    });
    if (!res.ok) throw new Error("PDF generation failed");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename + ".pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("PDF generation failed: " + e.message);
  }
};
  
  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🌾</span>
            <div>
              <h1>Pur Ferme</h1>
              <p>AI-Powered Crop Traceability</p>
            </div>
          </div>
        </div>
      </header>

      <main className="main">

        {/* ── LOCATION SECTION ─────────────────────────────────────────── */}
        <section className="section location-section">
          <h2 className="section-title">📍 Farm Location</h2>
          <p className="section-subtitle">
            Enter any village, town, or district — map, weather, soil, and 10-year climate data load automatically.
          </p>
          <div className="location-input-row">
            <input
              className="location-input"
              type="text"
              placeholder="e.g. Koraput, Jeypore, Anantapur, Bellary…"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLocation()}
            />
            <button
              className="btn btn-primary"
              onClick={loadLocation}
              disabled={locLoading || !locationInput.trim()}
            >
              {locLoading ? "Loading…" : "🔍 Load"}
            </button>
          </div>
          {locError && <div className="error-box">❌ {locError}</div>}
        </section>

        {/* ── LOCATION RESULT ───────────────────────────────────────────── */}
        {locData && (
          <section className="section">
            <div className="location-grid">
              {/* Map */}
              <div className="map-container">
                <MapView lat={locData.lat} lon={locData.lon} name={locData.name} />
              </div>

              {/* Info panels */}
              <div className="info-panels">
                {/* Location card */}
                <div className="info-card">
                  <h3>📍 Location</h3>
                  <div className="info-rows">
                    <div className="info-row"><span>Coordinates</span><strong>{locData.lat.toFixed(4)}°N, {locData.lon.toFixed(4)}°E</strong></div>
                    {locData.elevation && <div className="info-row"><span>Elevation</span><strong>{Math.round(locData.elevation)} m</strong></div>}
                    <div className="info-row"><span>Soil Type</span><strong>{locData.soil?.type}</strong></div>
                    <div className="info-row"><span>Soil pH</span><strong>{locData.soil?.ph}</strong></div>
                    <div className="info-row"><span>Deficiencies</span><strong>{locData.soil?.deficiencies}</strong></div>
                  </div>
                </div>

                {/* Weather card */}
                {locData.weather?.success && (
                  <div className="info-card">
                    <h3>🌦️ Live Weather</h3>
                    <div className="weather-grid">
                      <div className="weather-item">
                        <div className="weather-value">{locData.weather.temp}°C</div>
                        <div className="weather-label">Temperature</div>
                      </div>
                      <div className="weather-item">
                        <div className="weather-value">{locData.weather.humidity}%</div>
                        <div className="weather-label">Humidity</div>
                      </div>
                      <div className="weather-item">
                        <div className="weather-value">{locData.weather.wind_speed} m/s</div>
                        <div className="weather-label">Wind</div>
                      </div>
                      <div className="weather-item">
                        <div className="weather-value" style={{fontSize:"16px"}}>{locData.weather.condition}</div>
                        <div className="weather-label">Condition</div>
                      </div>
                    </div>
                    {/* Disease risk banner */}
                    {locData.weather.humidity > 80 && locData.weather.temp > 28
                      ? <div className="risk-banner risk-high">⚠️ High disease-risk conditions</div>
                      : locData.weather.humidity > 65
                      ? <div className="risk-banner risk-med">🟡 Moderate risk conditions</div>
                      : <div className="risk-banner risk-low">✅ Favorable conditions</div>
                    }
                  </div>
                )}

                {/* Historical this month */}
                {(() => {
                  const ma = locData.climate?.monthly_avg;
                  const cm = ma?.[new Date().getMonth() + 1];
                  return cm?.temp ? (
                    <div className="info-card">
                      <h3>📊 {cm.name} — 10yr Historical Avg</h3>
                      <div className="info-rows">
                        <div className="info-row"><span>Avg Temperature</span><strong>{cm.temp}°C</strong></div>
                        <div className="info-row"><span>Avg Humidity</span><strong>{cm.humidity}%</strong></div>
                        <div className="info-row"><span>Avg Rainfall</span><strong>{cm.rain}mm</strong></div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === "analysis" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("analysis")}
              >🌿 Crop Analysis</button>
              <button
                className={`tab ${activeTab === "planner" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("planner")}
              >🌱 Season Planner</button>
            </div>

            {/* ── CROP ANALYSIS TAB ─────────────────────────────────────── */}
            {activeTab === "analysis" && (
              <div className="tab-content">
                <p className="section-subtitle">
                  Upload a leaf image → AI detects the condition → Gemini explains why using live weather + 10-year climate data.
                </p>

                <div className="analysis-grid">
                  {/* Upload */}
                  <div>
                    <div
                      {...getRootProps()}
                      className={`dropzone ${isDragActive ? "dropzone-active" : ""}`}
                    >
                      <input {...getInputProps()} />
                      {imagePreview
                        ? <img src={imagePreview} alt="Uploaded leaf" className="preview-img" />
                        : <div className="dropzone-hint">
                            <div style={{fontSize:"48px"}}>📸</div>
                            <p>Drop a leaf image here or click to upload</p>
                            <p style={{fontSize:"13px",color:"#9ca3af"}}>JPG, PNG supported</p>
                          </div>
                      }
                    </div>
                    {imageFile && (
                      <button
                        className="btn btn-primary btn-full"
                        onClick={analyseImage}
                        disabled={analysisLoading}
                        style={{marginTop:"12px"}}
                      >
                        {analysisLoading ? "🤖 Analysing…" : "🔍 Analyse Crop Health"}
                      </button>
                    )}
                    {analysisError && <div className="error-box">{analysisError}</div>}
                  </div>

                  {/* Results */}
                  <div>
                    {analysisLoading && (
                      <div className="loading-card">
                        <div className="spinner" />
                        <p>Running disease detection + generating AI report…</p>
                        <p style={{fontSize:"13px",color:"#6b7280"}}>Usually takes 10–15 seconds</p>
                      </div>
                    )}

                    {analysisResult && (
                      <div>
                        {/* Grade result */}
                        <div className="result-card" style={{borderColor: gradeColor(analysisResult.grade)}}>
                          <div className="result-metrics">
                            <div className="metric">
                              <div className="metric-value">{analysisResult.pred_class}</div>
                              <div className="metric-label">Detected</div>
                            </div>
                            <div className="metric">
                              <div className="metric-value">{analysisResult.confidence}%</div>
                              <div className="metric-label">Confidence</div>
                            </div>
                            <div className="metric">
                              <div className="metric-value" style={{color: gradeColor(analysisResult.grade)}}>
                                Grade {analysisResult.grade}
                              </div>
                              <div className="metric-label">Supply Chain</div>
                            </div>
                          </div>
                          <div
                            className="grade-badge"
                            style={{background: gradeColor(analysisResult.grade)}}
                          >
                            {gradeIcon(analysisResult.grade)} {analysisResult.grade_label}
                          </div>
                        </div>

                        {/* Class probabilities */}
                        <div className="probs-card">
                          <h4>Class Probabilities</h4>
                          {Object.entries(analysisResult.all_probs).map(([cls, pct]) => (
                            <div key={cls} className="prob-row">
                              <span className="prob-label">{cls}</span>
                              <div className="prob-bar-bg">
                                <div
                                  className="prob-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: cls === "Healthy" ? "#16a34a" : "#dc2626"
                                  }}
                                />
                              </div>
                              <span className="prob-pct">{pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* LLM Report */}
                {analysisResult?.llm_report && (
                  <div className="report-card">
                    <div className="report-header">
                      <h3>🧑‍🌾 AI Agronomist Report</h3>
                      <span className="report-badge">{analysisResult.llm_name} + 10yr Climate Data</span>
                    </div>
                    <div className="report-body">
                      <ReactMarkdown>{analysisResult.llm_report}</ReactMarkdown>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => downloadReport(
                        // `<div class="report-body">${analysisResult.llm_report.replace(/\n/g,'<br>')}</div>`,
                        analysisResult.llm_report,
                        `PurFerme_CropHealth_${locData.name}_${new Date().toISOString().slice(0,10)}`,
                        // `PurFerme_CropHealth_${locData.name}_${new Date().toISOString().slice(0,10)}`
                        "analysis",
                        analysisResult
                      )}
                    >
                      ⬇️ Download Certificate (PDF)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SEASON PLANNER TAB ────────────────────────────────────── */}
            {activeTab === "planner" && (
              <div className="tab-content">
                <p className="section-subtitle">
                  Enter your sowing date — Gemini builds a full season plan using 10 years of real climate data for {locData.name}.
                </p>

                <div className="planner-input-row">
                  <div className="input-group">
                    <label>📅 Sowing / Crop Start Date</label>
                    <input
                      type="date"
                      className="date-input"
                      value={sowingDate}
                      onChange={(e) => setSowingDate(e.target.value)}
                      min="2024-01-01"
                      max="2030-12-31"
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={generatePlan}
                    disabled={planLoading || !sowingDate}
                  >
                    {planLoading ? "✨ Generating…" : "🚀 Generate Season Plan"}
                  </button>
                </div>

                {planError && <div className="error-box">{planError}</div>}

                {planLoading && (
                  <div className="loading-card">
                    <div className="spinner" />
                    <p>Building season plan from 10-year climate data…</p>
                    <p style={{fontSize:"13px",color:"#6b7280"}}>Usually takes 15–20 seconds</p>
                  </div>
                )}

                {planResult && (
                  <div className="report-card">
                    <div className="report-header">
                      <div>
                        <h3>🗓️ Season Plan — {locData.name}</h3>
                        <p style={{margin:"4px 0",fontSize:"14px",color:"#6b7280"}}>
                          Sowing: <strong>{new Date(sowingDate).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</strong>
                          &nbsp;|&nbsp; Est. Harvest: <strong>{planResult.harvest_est}</strong>
                          &nbsp;|&nbsp; Duration: <strong>85 days</strong>
                        </p>
                      </div>
                      <span className="report-badge">{planResult.llm_name} + Open-Meteo 10yr</span>
                    </div>
                    <div className="report-body">
                      <ReactMarkdown>{planResult.plan}</ReactMarkdown>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => downloadReport(
                        planResult.plan,
                        // `<div>${planResult.plan.replace(/\n/g,'<br>')}</div>`,
                        `PurFerme_SeasonPlan_${locData.name}_${sowingDate}`,
                        "plan",
                        planResult
                      )}
                    >
                      ⬇️ Download Season Plan (PDF)
                    </button>
                    
                    
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>🌾 Pur Ferme Traceability System — AI-Powered Crop Health & Season Planning</p>
        <p style={{fontSize:"12px",opacity:0.7}}>FastAI Disease Model + Gemini 2.5 Flash + Open-Meteo 10yr Climate Data</p>
      </footer>
    </div>
  );
}
