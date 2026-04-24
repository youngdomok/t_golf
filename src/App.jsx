import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Download, Play, Users, Calendar, AlertCircle } from 'lucide-react';
import { generateOptimizedSchedule } from './utils/optimizer';

function App() {
  const [players, setPlayers] = useState([]);
  const [days, setDays] = useState(3);
  const [schedule, setSchedule] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assume first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Extract columns A, B, C, D
        const extractedPlayers = json
          .filter(row => row[0] && typeof row[0] === 'string' && row[0].trim() !== '이름' && row[0].trim() !== 'Name' && row[0].trim().length > 0)
          .map(row => ({
            name: row[0].trim(),
            handicap: row[1] !== undefined && row[1] !== null && row[1] !== '' && !isNaN(Number(row[1])) ? Number(row[1]) : null,
            avoidGroup: row[2] ? String(row[2]).trim() : null,
            mustGroup: row[3] ? String(row[3]).trim() : null
          }));

        // Remove duplicates just in case
        const uniquePlayers = [];
        const seen = new Set();
        for (const p of extractedPlayers) {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            uniquePlayers.push(p);
          }
        }

        if (uniquePlayers.length < 3) {
          setError('조를 편성하기에 인원이 너무 적습니다. (최소 3명 필요)');
          setPlayers([]);
        } else {
          setPlayers(uniquePlayers);
          setSchedule(null); // Reset schedule when new players are uploaded
        }
      } catch (err) {
        console.error(err);
        setError('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = () => {
    if (players.length === 0) {
      setError('먼저 플레이어 명단을 업로드해주세요.');
      return;
    }
    if (days < 1) {
      setError('라운드 일수는 최소 1일 이상이어야 합니다.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Use setTimeout to allow UI to update to loading state before heavy calculation
    setTimeout(() => {
      try {
        const result = generateOptimizedSchedule(players, days, 50000);
        setSchedule(result);
      } catch (err) {
        console.error(err);
        setError('조편성 시뮬레이션 중 오류가 발생했습니다.');
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const handleDownload = () => {
    if (!schedule) return;

    // Prepare data for Excel
    const exportData = [
      ['날짜', '조 번호', '플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4']
    ];

    schedule.forEach((dayGroups, dayIndex) => {
      dayGroups.forEach((group, groupIndex) => {
        const row = [
          `Day ${dayIndex + 1}`,
          `${groupIndex + 1}조`,
          group[0] ? group[0].name : '',
          group[1] ? group[1].name : '',
          group[2] ? group[2].name : '',
          group[3] ? group[3].name : ''
        ];
        exportData.push(row);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    
    // Auto-size columns slightly
    const colWidths = [
      { wch: 10 }, // 날짜
      { wch: 10 }, // 조 번호
      { wch: 15 }, // P1
      { wch: 15 }, // P2
      { wch: 15 }, // P3
      { wch: 15 }, // P4
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '조편성 결과');

    XLSX.writeFile(workbook, 'golf_groups_schedule.xlsx');
  };

  return (
    <div className="container animate-fade-in" style={{ position: 'relative', minHeight: '100vh', paddingBottom: '4rem' }}>
      <header className="header">
        <h1 className="text-gradient">Golf Grouping Optimizer</h1>
        <p>최적의 골프 라운드 조편성을 자동으로 생성하세요. 중복 만남을 최소화하고 핸디캡, 기피/필수 조건을 모두 고려하여 시뮬레이션합니다.</p>
      </header>

      <div className="main-grid">
        <aside className="controls-sidebar">
          {/* File Upload Panel */}
          <div className="glass-panel">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
              <Users size={20} className="text-gradient" /> 명단 업로드
            </h2>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className={`upload-area ${players.length > 0 ? 'active' : ''}`}>
              <UploadCloud size={40} className="upload-icon" />
              <div className="upload-text">
                {players.length > 0 ? `명단 로드 완료 (${players.length}명)` : '클릭하여 엑셀 파일 업로드'}
              </div>
              <div className="upload-hint">A열: 이름, B열: 핸디캡, C열: 기피(X), D열: 필수(O)</div>
            </label>

            {players.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>참가자 미리보기:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {players.slice(0, 15).map((p, i) => (
                    <div key={i} style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {p.handicap !== null && <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>H:{p.handicap}</span>}
                        {p.avoidGroup && <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px' }}>기피:{p.avoidGroup}</span>}
                        {p.mustGroup && <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px' }}>필수:{p.mustGroup}</span>}
                      </div>
                    </div>
                  ))}
                  {players.length > 15 && <div className="player-tag" style={{ padding: '0.25rem 0.75rem' }}>+{players.length - 15}명</div>}
                </div>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <div className="glass-panel">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
              <Calendar size={20} className="text-gradient" /> 라운드 설정
            </h2>
            
            <div className="input-group">
              <label htmlFor="days">라운딩 일정 (일수)</label>
              <input 
                type="number" 
                id="days"
                min="1" 
                max="30"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={handleGenerate}
              disabled={isGenerating || players.length === 0}
            >
              <Play size={18} />
              {isGenerating ? '시뮬레이션 중...' : '조편성 시뮬레이션'}
            </button>
          </div>
        </aside>

        {/* Results Panel */}
        <main className="glass-panel" style={{ minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>시뮬레이션 결과</h2>
            <button 
              className="btn btn-outline"
              onClick={handleDownload}
              disabled={!schedule}
            >
              <Download size={18} /> 엑셀 다운로드
            </button>
          </div>

          {!schedule ? (
            <div className="empty-state">
              <div style={{ opacity: 0.5, marginBottom: '1rem' }}>
                <Calendar size={64} style={{ margin: '0 auto' }} />
              </div>
              <p>명단을 업로드하고 시뮬레이션을 실행하면<br/>여기에 결과가 표시됩니다.</p>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {schedule.map((dayGroups, dayIndex) => (
                <div key={dayIndex}>
                  <h3 className="day-header">
                    <span style={{ 
                      background: 'var(--accent-primary)', 
                      color: 'white', 
                      width: '32px', 
                      height: '32px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}>{dayIndex + 1}</span>
                    Day {dayIndex + 1}
                  </h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>조 번호</th>
                          <th>플레이어 1</th>
                          <th>플레이어 2</th>
                          <th>플레이어 3</th>
                          <th>플레이어 4</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayGroups.map((group, groupIndex) => (
                          <tr key={groupIndex}>
                            <td style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>{groupIndex + 1}조</td>
                            <td>{group[0] ? group[0].name : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td>{group[1] ? group[1].name : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td>{group[2] ? group[2].name : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td>{group[3] ? group[3].name : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '1rem',
        right: '2rem',
        fontSize: '0.75rem',
        color: '#ffffff',
        opacity: 0.9
      }}>
        B 핸디, C 동일한 표시 다른 조, D 동일한 표시 같은 조
      </div>
    </div>
  );
}

export default App;
