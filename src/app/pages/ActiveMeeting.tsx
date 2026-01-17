import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Users,
  Settings,
  Bot,
  MessageSquare,
  Languages,
  Pin,
  ChevronRight,
  ChevronLeft,
  MonitorUp,
  Paperclip,
  Smile,
  AlertTriangle,
  Clock,
  Send,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ProfileSettingsModal, SystemSettingsModal } from '../components/SettingsModals';
import { toast } from 'sonner';
// LiveKit imports
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// --- Types ---
interface Participant {
  id: string;
  name: string;
  isVideoOn: boolean;
  isMuted: boolean;
  isSpeaking?: boolean;
  language?: 'ja' | 'ko';
}

interface TranslationLog {
  id: string;
  speaker: string;
  originalText: string;
  translatedText: string;
  originalLang: 'ja' | 'ko';
  timestamp: Date;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  isAI?: boolean;
}

interface TermExplanation {
  id: string;
  term: string;
  explanation: string;
  detectedFrom: string;
  timestamp: Date;
}

type SidebarTab = 'translation' | 'chat' | 'members';

// --- ActiveMeetingContent Component ---
function ActiveMeetingContent({ 
  meetingId, 
  currentUserProp,
  devices: initialDevices,
  initialSettings
}: { 
  meetingId: string, 
  currentUserProp: any,
  devices?: { 
    audioInputId?: string; 
    videoInputId?: string; 
    audioOutputId?: string; 
  },
  initialSettings?: { isMicOn: boolean, isVideoOn: boolean }
}) {
  const navigate = useNavigate();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Tracks
  const tracks = useTracks(
    [Track.Source.Camera],
    { onlySubscribed: false } // 自分のビデオも含む
  );
  const localTrack = tracks.find(t => t.participant.isLocal);
  const remoteTracks = tracks.filter(t => !t.participant.isLocal);
  
  const [currentUser] = useState(currentUserProp);
  
  // Media State
  const [isMicOn, setIsMicOn] = useState(initialSettings?.isMicOn ?? true);
  const [isVideoOn, setIsVideoOn] = useState(initialSettings?.isVideoOn ?? true);

  // デバイスリスト State
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  
  // 選択中のデバイスID (初期値をPropsから設定)
  const [selectedMicId, setSelectedMicId] = useState<string>(initialDevices?.audioInputId || '');
  const [selectedCameraId, setSelectedCameraId] = useState<string>(initialDevices?.videoInputId || '');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(initialDevices?.audioOutputId || '');

  // UI State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [translationLogs, setTranslationLogs] = useState<TranslationLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('translation');
  const [termExplanations, setTermExplanations] = useState<TermExplanation[]>([]);
  const [meetingTitle] = useState('日韓プロジェクト会議');
  const [startTime] = useState(new Date());
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showEndMeetingConfirm, setShowEndMeetingConfirm] = useState(false);

  // Profile Settings State
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showSystemSettings, setShowSystemSettings] = useState(false); // 内部モーダルを使うため未使用だが互換性のため残存
  const [userName, setUserName] = useState('ユーザー');
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [avatarType, setAvatarType] = useState<'emoji' | 'image' | 'none'>('none');
  const [editedUserName, setEditedUserName] = useState('');
  const [editedUserAvatar, setEditedUserAvatar] = useState('');
  const [editedAvatarType, setEditedAvatarType] = useState<'emoji' | 'image' | 'none'>('none');
  const [systemLanguage, setSystemLanguage] = useState<'ja' | 'ko' | 'en'>('ja');

  // --- 1. デバイス情報の取得と同期 ---
  useEffect(() => {
    const syncDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const micList = devices.filter(d => d.kind === 'audioinput');
        const camList = devices.filter(d => d.kind === 'videoinput');
        const spkList = devices.filter(d => d.kind === 'audiooutput');

        setMics(micList);
        setCameras(camList);
        setSpeakers(spkList);
        
        if (room) {
          const activeMic = room.getActiveDevice('audioinput') || initialDevices?.audioInputId;
          const activeCam = room.getActiveDevice('videoinput') || initialDevices?.videoInputId;
          const activeSpeaker = room.getActiveDevice('audiooutput') || initialDevices?.audioOutputId;
          
          if (activeMic) setSelectedMicId(activeMic);
          else if (micList.length > 0 && !selectedMicId) setSelectedMicId(micList[0].deviceId);

          if (activeCam) setSelectedCameraId(activeCam);
          else if (camList.length > 0 && !selectedCameraId) setSelectedCameraId(camList[0].deviceId);

          if (activeSpeaker) setSelectedSpeakerId(activeSpeaker);
          else if (spkList.length > 0 && !selectedSpeakerId) setSelectedSpeakerId(spkList[0].deviceId);
        }
      } catch (e) {
        console.error("Error syncing devices:", e);
      }
    };

    if (showSettings) {
      syncDevices();
    }

    navigator.mediaDevices.addEventListener('devicechange', syncDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', syncDevices);
  }, [room, showSettings, initialDevices]); 

  // --- 2. 初期スピーカー設定の反映 ---
  useEffect(() => {
    if (initialDevices?.audioOutputId && room) {
      room.switchActiveDevice('audiooutput', initialDevices.audioOutputId).catch(console.warn);
      setSelectedSpeakerId(initialDevices.audioOutputId);
    }
  }, [room, initialDevices?.audioOutputId]);

  // --- 3. デバイス変更ハンドラ ---
  const handleDeviceChange = async (kind: MediaDeviceKind, deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice(kind, deviceId);
      if (kind === 'audioinput') setSelectedMicId(deviceId);
      if (kind === 'videoinput') setSelectedCameraId(deviceId);
      if (kind === 'audiooutput') setSelectedSpeakerId(deviceId);
      toast.success('デバイスを変更しました');
    } catch (e) {
      console.error(`Failed to switch ${kind}:`, e);
      toast.error('デバイスの変更に失敗しました');
    }
  };

  // --- 4. プロファイル設定の同期 ---
  useEffect(() => {
    const handleOpenProfile = () => {
      setEditedUserName(userName);
      setEditedUserAvatar(userAvatar);
      setEditedAvatarType(avatarType);
      setShowProfileSettings(true);
    };
    const handleProfileUpdated = () => {
      const savedProfile = localStorage.getItem('uri-tomo-user-profile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          setUserName(profile.name || 'ユーザー');
          setUserEmail(profile.email || '');
          setUserAvatar(profile.avatar || '');
          setAvatarType(profile.avatarType || 'none');
        } catch (e) { console.error(e); }
      }
    };

    window.addEventListener('open-profile-settings', handleOpenProfile);
    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      window.removeEventListener('open-profile-settings', handleOpenProfile);
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, [userName, userAvatar, avatarType]);

  useEffect(() => {
    const savedUser = localStorage.getItem('uri-tomo-user');
    const savedProfile = localStorage.getItem('uri-tomo-user-profile');
    const savedLanguage = localStorage.getItem('uri-tomo-system-language');

    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUserName(profile.name || 'ユーザー');
        setUserEmail(profile.email || savedUser || '');
        setUserAvatar(profile.avatar || '');
        setAvatarType(profile.avatarType || 'none');
      } catch (e) {}
    } else if (savedUser) {
      setUserEmail(savedUser);
      setUserName(savedUser.split('@')[0]);
    }
    if (savedLanguage) setSystemLanguage(savedLanguage as 'ja' | 'ko' | 'en');
  }, []);

  // --- 5. ダミーデータ生成（参加者・ログ・タイマー） ---
  useEffect(() => {
    const defaultParticipants: Participant[] = [
      { id: '1', name: 'User A', isVideoOn: true, isMuted: false, language: 'ja' },
      { id: '2', name: 'User B', isVideoOn: true, isMuted: false, language: 'ko' },
      { id: '3', name: 'User C', isVideoOn: false, isMuted: true, language: 'ja' },
    ];
    setParticipants(defaultParticipants);

    const sampleLogs: TranslationLog[] = [
      { id: '1', speaker: 'User A', originalText: 'プロジェクトの進捗について報告します', translatedText: '프로젝트 진행 상황에 대해 보고합니다', originalLang: 'ja', timestamp: new Date(Date.now() - 5000) },
      { id: '2', speaker: 'User B', originalText: '感사します。次のステップについて論議したいです', translatedText: 'ありがとうございます。次のステップについて議論したいです', originalLang: 'ko', timestamp: new Date(Date.now() - 3000) },
    ];
    setTranslationLogs(sampleLogs);

    const sampleTerms: TermExplanation[] = [
      { id: '1', term: 'プロジェクトの進捗', explanation: 'プロジェクトがどれだけ進んでいるかを示す指標。', detectedFrom: 'User Aの発言', timestamp: new Date(Date.now() - 4000) },
      { id: '2', term: '次のステップ', explanation: 'これから行うべき次の行動や段階。', detectedFrom: 'User Bの発言', timestamp: new Date(Date.now() - 2000) },
    ];
    setTermExplanations(sampleTerms);

    const timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndMeeting = () => setShowEndMeetingConfirm(true);
  
  const confirmEndMeeting = () => {
    const endTime = new Date();
    // Meeting Record Save Logic
    const meetingRecord = {
      id: meetingId || Date.now().toString(),
      title: meetingTitle,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      participants: [
        { id: 'me', name: currentUser.name, language: currentUser.language },
        ...participants.map(p => ({ id: p.id, name: p.name, language: p.language || 'ja' })),
      ],
      translationLog: translationLogs.map(log => ({
        id: log.id,
        speaker: log.speaker,
        originalText: log.originalText,
        translatedText: log.translatedText,
        originalLang: log.originalLang === 'ja' ? '🇯🇵 日本語' : '🇰🇷 한국어',
        translatedLang: log.originalLang === 'ja' ? '🇰🇷 한국어' : '🇯🇵 日本語',
        timestamp: log.timestamp.toISOString(),
      })),
      chatMessages: chatMessages.map(msg => ({
        id: msg.id,
        userName: msg.sender,
        message: msg.message,
        timestamp: msg.timestamp.toISOString(),
        isAI: msg.isAI,
      })),
      summary: {
        keyPoints: ['プロジェクトの進捗報告完了', '次期スプリントの計画確認'],
        actionItems: ['次回までにタスク完了'],
        decisions: ['リリース日は2週間後'],
      },
    };

    const savedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    const updatedMeetings = [...savedMeetings, meetingRecord];
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));

    navigate(`/minutes/${meetingId || Date.now()}`);
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages([...chatMessages, { id: Date.now().toString(), sender: currentUser.name, message: chatInput, timestamp: new Date() }]);
      setChatInput('');
    }
  };

  const handleFileAttach = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setChatMessages([...chatMessages, { id: Date.now().toString(), sender: currentUser.name, message: `📎 ${file.name}`, timestamp: new Date() }]);
      }
    };
    input.click();
  };

  const handleStickerSelect = (sticker: string) => {
    setChatMessages([...chatMessages, { id: Date.now().toString(), sender: currentUser.name, message: sticker, timestamp: new Date() }]);
    setShowStickerPicker(false);
  };

  const toggleMic = async () => {
    const newState = !isMicOn;
    setIsMicOn(newState);
    if (localParticipant) await localParticipant.setMicrophoneEnabled(newState);
  };

  const toggleVideo = async () => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);
    if (localParticipant) await localParticipant.setCameraEnabled(newState);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-bold text-lg">{meetingTitle}</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-semibold">{formatDuration(duration)}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Toggle Sidebar Button */}
        {!isSidebarOpen && (
          <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={() => setIsSidebarOpen(true)} className="absolute top-4 right-4 z-10 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-semibold transition-all">
            <Bot className="h-5 w-5" /><span>Uri-Tomoを開く</span><ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}

        <PanelGroup direction="horizontal">
          {/* Video Grid Panel */}
          <Panel defaultSize={isSidebarOpen ? 70 : 100} minSize={50}>
            <div className="h-full p-4 bg-gray-900">
              <div className="h-full grid grid-cols-2 gap-4">
                {/* Uri-Tomo Bot */}
                <motion.div className="relative bg-gradient-to-br from-yellow-900 to-amber-900 rounded-xl overflow-hidden border-2 border-yellow-400">
                  <div className="absolute top-3 right-3 z-10 bg-yellow-400 p-2 rounded-lg shadow-lg"><Pin className="h-4 w-4 text-gray-900" /></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-gradient-to-br from-yellow-400/20 to-amber-400/20 flex items-center justify-center">
                      <Bot className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg flex items-center gap-2">
                      <span className="text-white text-sm font-semibold">Uri-Tomo</span>
                      <span className="text-xs text-yellow-300 bg-yellow-600 px-2 py-0.5 rounded font-semibold">AI</span>
                    </div>
                    <div className="bg-green-600 p-2 rounded-lg animate-pulse"><Mic className="h-4 w-4 text-white" /></div>
                  </div>
                </motion.div>

                {/* Local User (Modified: added transform -scale-x-100) */}
                <motion.div className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 hover:border-yellow-400 transition-all">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {localTrack?.publication?.isSubscribed ? (
                      <VideoTrack trackRef={localTrack} className="w-full h-full object-cover transform -scale-x-100" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-400 flex items-center justify-center text-white font-bold text-3xl">{currentUser?.name?.charAt(0) || '?'}</div>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg flex items-center gap-2"><span className="text-white text-sm font-semibold">{currentUser.name} (あなた)</span></div>
                    {!isMicOn && <div className="bg-red-600 p-2 rounded-lg"><MicOff className="h-4 w-4 text-white" /></div>}
                  </div>
                </motion.div>

                {/* Remote Participants */}
                {remoteTracks.map((track) => (
                  <motion.div key={track.participant.identity} className="relative bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 hover:border-yellow-400 transition-all">
                    <div className="absolute inset-0 flex items-center justify-center"><VideoTrack trackRef={track} className="w-full h-full object-cover" /></div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg flex items-center gap-2"><span className="text-white text-sm font-semibold">{track.participant.identity}</span><span className="text-xs text-gray-300 bg-gray-600 px-2 py-0.5 rounded">REMOTE</span></div>
                      {!track.participant.isMicrophoneEnabled && <div className="bg-red-600 p-2 rounded-lg"><MicOff className="h-4 w-4 text-white" /></div>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Sidebar Panel */}
          {isSidebarOpen && (
            <>
              <PanelResizeHandle className="w-2 bg-gray-700 hover:bg-yellow-400 transition-colors cursor-col-resize" />
              <Panel defaultSize={30} minSize={25} maxSize={50}>
                <div className="h-full bg-white flex flex-col">
                  {/* Uri-Tomo Header */}
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 bg-white rounded-full flex items-center justify-center"><Bot className="h-5 w-5 text-yellow-600" /></div><div><h3 className="text-white font-bold text-sm">Uri-Tomo</h3><p className="text-yellow-100 text-xs">AI翻訳アシスタント</p></div></div>
                      <button onClick={() => setIsSidebarOpen(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                  </div>
                  {/* Description Section */}
                  <div className="border-b border-gray-200 bg-white max-h-48 overflow-y-auto">
                    <div className="sticky top-0 bg-white px-4 pt-4 pb-2 border-b border-gray-100"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-yellow-600" /><h4 className="font-bold text-gray-900 text-sm">Description</h4><span className="text-xs text-gray-500">({termExplanations.length}件の用語解説)</span></div></div>
                    <div className="p-4">
                      {termExplanations.map((term, index) => (
                        <motion.div key={term.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-3 border border-yellow-200 mb-2">
                          <div className="flex items-start gap-2 mb-1"><div className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-1.5 flex-shrink-0" /><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-sm text-gray-900">{term.term}</span><span className="text-xs text-gray-400">{term.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span></div><p className="text-xs text-gray-700 leading-relaxed">{term.explanation}</p><p className="text-xs text-yellow-700 mt-1">💡 {term.detectedFrom}</p></div></div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="flex border-b border-gray-200 bg-gray-50">
                    <button onClick={() => setActiveTab('translation')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'translation' ? 'bg-white text-yellow-600 border-b-2 border-yellow-400' : 'text-gray-600 hover:text-gray-900'}`}><div className="flex items-center justify-center gap-2"><Languages className="h-4 w-4" /><span>Translation</span></div></button>
                    <button onClick={() => setActiveTab('chat')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'bg-white text-yellow-600 border-b-2 border-yellow-400' : 'text-gray-600 hover:text-gray-900'}`}><div className="flex items-center justify-center gap-2"><MessageSquare className="h-4 w-4" /><span>チャット</span></div></button>
                    <button onClick={() => setActiveTab('members')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'members' ? 'bg-white text-yellow-600 border-b-2 border-yellow-400' : 'text-gray-600 hover:text-gray-900'}`}><div className="flex items-center justify-center gap-2"><Users className="h-4 w-4" /><span>メンバー</span></div></button>
                  </div>
                  {/* Tab Content */}
                  <div className="flex-1 overflow-hidden">
                    {/* Translation Tab */}
                    {activeTab === 'translation' && (
                      <div className="h-full flex flex-col bg-gradient-to-b from-yellow-50 to-white">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {translationLogs.map((log, index) => (
                            <motion.div key={log.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`bg-white rounded-xl p-4 shadow-md border-2 transition-all ${index === translationLogs.length - 1 ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-gray-200'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-sm">{log.speaker.charAt(0)}</div>
                                  <span className="text-sm font-bold text-gray-900">{log.speaker}</span>
                                </div>
                                <span className="text-xs text-gray-500">{log.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="mb-3 pb-3 border-b border-gray-200">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{log.originalLang === 'ja' ? '🇯🇵 日本語' : '🇰🇷 韓国語'}</span><span className="text-xs text-gray-500">Original</span></div>
                                <p className="text-base text-gray-900 leading-relaxed">{log.originalText}</p>
                              </div>
                              <div className="bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg p-3 border-2 border-yellow-300">
                                <div className="flex items-center gap-2 mb-2"><Languages className="h-4 w-4 text-yellow-700" /><span className="text-xs font-bold text-yellow-800 bg-yellow-200 px-2 py-1 rounded">{log.originalLang === 'ja' ? '🇰🇷 韓国語訳' : '🇯🇵 日本語訳'}</span></div>
                                <p className="text-base text-gray-900 font-semibold leading-relaxed">{log.translatedText}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Chat Tab */}
                    {activeTab === 'chat' && (
                      <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {chatMessages.length === 0 ? (
                            <div className="text-center py-8"><div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center"><MessageSquare className="h-6 w-6 text-gray-400" /></div><p className="text-sm text-gray-500">まだメッセージがありません</p></div>
                          ) : (
                            chatMessages.map((msg) => (
                              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.sender === currentUser.name ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 ${msg.isAI ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300' : msg.sender === currentUser.name ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                                  <div className="flex items-center gap-2 mb-1">{msg.isAI && <Bot className="h-3 w-3 text-yellow-600" />}<span className="text-xs font-semibold">{msg.sender}</span><span className="text-xs opacity-60">{msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                  <p className="text-sm">{msg.message}</p>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                        <div className="border-t border-gray-200 p-4">
                          {showStickerPicker && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-300 shadow-lg">
                              <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Smile className="h-4 w-4 text-yellow-600" />スタンプ</h4><button onClick={() => setShowStickerPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
                              <div className="grid grid-cols-5 gap-2">{['👍', '👏', '😊', '❤️', '🎉', '✨', '💡', '🔥', '👌', '🙌', '💪', '🚀', '⭐', '✅', '📌'].map((s) => (<button key={s} onClick={() => handleStickerSelect(s)} className="text-3xl p-3 hover:bg-yellow-200 rounded transition">{s}</button>))}</div>
                            </motion.div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={handleFileAttach} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Paperclip className="h-5 w-5" /></button>
                            <button onClick={() => setShowStickerPicker(!showStickerPicker)} className={`p-2 rounded-lg ${showStickerPicker ? 'bg-yellow-200' : 'hover:bg-gray-100'}`}><Smile className="h-5 w-5" /></button>
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendChat()} placeholder="メッセージ..." className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                            <Button onClick={handleSendChat} disabled={!chatInput.trim()} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg px-4"><Send className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Members Tab */}
                    {activeTab === 'members' && (
                      <div className="h-full overflow-y-auto p-4">
                        <div className="mb-4"><h4 className="text-sm font-bold text-gray-900">参加者 ({participants.length + 2}人)</h4></div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-400 flex items-center justify-center"><Bot className="h-5 w-5 text-white" /></div>
                            <div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold">Uri-Tomo</span><span className="text-xs bg-yellow-400 px-2 py-0.5 rounded font-semibold">AI</span></div><p className="text-xs text-gray-600">AI翻訳アシスタント</p></div>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><Mic className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-400 flex items-center justify-center text-white font-bold">{currentUser.name.charAt(0)}</div>
                            <div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{currentUser.name} (あなた)</span><span className="text-xs bg-gray-200 px-2 py-0.5 rounded">JA</span></div></div>
                            {isMicOn ? <Mic className="h-4 w-4 text-green-600" /> : <MicOff className="h-4 w-4 text-red-600" />}
                          </div>
                          {participants.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">{p.name.charAt(0)}</div>
                              <div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{p.name}</span><span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{p.language === 'ja' ? 'JA' : 'KO'}</span></div></div>
                              {!p.isMuted ? <Mic className="h-4 w-4 text-green-600" /> : <MicOff className="h-4 w-4 text-red-600" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          <Button onClick={toggleMic} className={`rounded-full w-12 h-12 ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}>{isMicOn ? <Mic className="h-5 w-5 text-white" /> : <MicOff className="h-5 w-5 text-white" />}</Button>
          <Button onClick={toggleVideo} className={`rounded-full w-12 h-12 ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}>{isVideoOn ? <Video className="h-5 w-5 text-white" /> : <VideoOff className="h-5 w-5 text-white" />}</Button>
          <Button onClick={() => setShowEndMeetingConfirm(true)} className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700"><PhoneOff className="h-5 w-5 text-white" /></Button>
          <Button variant="ghost" onClick={() => setShowSettings(true)} className="rounded-full w-12 h-12 bg-gray-700 hover:bg-gray-600"><Settings className="h-5 w-5 text-white" /></Button>
        </div>
      </footer>

      {/* Settings Modal (Fully Implemented) */}
      {showSettings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center"><Settings className="h-5 w-5 text-yellow-600" /></div><div><h2 className="text-white font-bold text-lg">システム設定</h2><p className="text-yellow-100 text-xs">Device & Meeting Settings</p></div></div>
              <Button variant="ghost" onClick={() => setShowSettings(false)} className="text-white hover:bg-white/20 rounded-full w-8 h-8 p-0">✕</Button>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2"><Mic className="h-5 w-5 text-gray-700" /><h3 className="font-bold text-gray-900">オーディオ設定</h3></div>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">マイク</label>
                    <select value={selectedMicId} onChange={(e) => handleDeviceChange('audioinput', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 text-sm bg-white">
                      {mics.map(mic => <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">スピーカー</label>
                    <select value={selectedSpeakerId} onChange={(e) => handleDeviceChange('audiooutput', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 text-sm bg-white" disabled={speakers.length === 0}>
                      {speakers.length > 0 ? speakers.map(spk => <option key={spk.deviceId} value={spk.deviceId}>{spk.label || `Speaker ${spk.deviceId.slice(0, 5)}...`}</option>) : <option value="">デフォルト (変更不可)</option>}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2"><Video className="h-5 w-5 text-gray-700" /><h3 className="font-bold text-gray-900">ビデオ設定</h3></div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">カメラ</label>
                  <select value={selectedCameraId} onChange={(e) => handleDeviceChange('videoinput', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 text-sm bg-white">
                    {cameras.map(cam => <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2"><Languages className="h-5 w-5 text-yellow-600" /><h3 className="font-bold text-gray-900">Uri-Tomo AI翻訳設定</h3></div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex justify-between items-center">
                  <div><p className="text-sm font-semibold text-gray-900">リアルタイム翻訳</p><p className="text-xs text-gray-500">日韓自動翻訳を有効化</p></div>
                  <input type="checkbox" className="toggle" defaultChecked />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3 shrink-0">
              <Button onClick={() => setShowSettings(false)} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold">閉じる</Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showEndMeetingConfirm && (
        <motion.div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-xl w-96 shadow-2xl">
              <div className="flex flex-col items-center gap-4 mb-6"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div><h2 className="text-xl font-bold text-gray-900">会議を終了しますか？</h2></div>
              <div className="flex justify-end gap-3"><Button onClick={() => setShowEndMeetingConfirm(false)} variant="outline" className="flex-1">キャンセル</Button><Button onClick={confirmEndMeeting} variant="destructive" className="flex-1">終了する</Button></div>
           </div>
        </motion.div>
      )}

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        avatarType={avatarType}
        editedUserName={editedUserName}
        editedUserAvatar={editedUserAvatar}
        editedAvatarType={editedAvatarType}
        systemLanguage={systemLanguage}
        onNameChange={setEditedUserName}
        onAvatarChange={setEditedUserAvatar}
        onAvatarTypeChange={setEditedAvatarType}
        onAvatarImageUpload={(e) => {}}
        onSave={() => setShowProfileSettings(false)}
      />
    </div>
  );
}

// --- Main ActiveMeeting Component ---
export function ActiveMeeting() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { 
    livekitToken, 
    livekitUrl, 
    participantName,
    initialMicOn,
    initialVideoOn,
    audioDeviceId,
    videoDeviceId,
    audioOutputDeviceId
  } = location.state || {};

  useEffect(() => {
    if (!livekitToken || !livekitUrl) {
      toast.error('接続情報がありません。設定画面に戻ります。');
      navigate(`/meeting-setup/${id}`);
    }
  }, [livekitToken, livekitUrl, navigate, id]);

  if (!livekitToken || !livekitUrl) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Connecting...</div>;

  return (
    <LiveKitRoom
      // デバイスID指定で初期化 (重要: これがないとデフォルトカメラに戻ってしまう)
      video={initialVideoOn ?? true ? (videoDeviceId ? { deviceId: videoDeviceId } : true) : false}
      audio={initialMicOn ?? true ? (audioDeviceId ? { deviceId: audioDeviceId } : true) : false}
      token={livekitToken}
      serverUrl={livekitUrl}
      data-lk-theme="default"
      onDisconnected={() => navigate('/')}
      className="h-screen w-full bg-gray-900"
      style={{ height: '100vh' }}
    >
      <ActiveMeetingContent 
        meetingId={id || ''} 
        currentUserProp={{ name: participantName || 'Me', language: 'ja' }} 
        // 選択されたデバイス情報を渡す
        devices={{ 
          audioInputId: audioDeviceId,
          videoInputId: videoDeviceId,
          audioOutputId: audioOutputDeviceId 
        }}
        initialSettings={{ isMicOn: initialMicOn, isVideoOn: initialVideoOn }}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}