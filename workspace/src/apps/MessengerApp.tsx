import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, tenantCol, tenantDoc, logAudit, appId } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: number;
}

interface Chat {
  id: string;
  type: string;
  title?: string;
  participants: string[];
  lastMessage?: { text: string; senderId: string; timestamp: number };
  unreadCounts?: Record<string, number>;
}

interface TenantUser {
  id: string;
  name?: string;
  email?: string;
}

export default function MessengerApp({ currentUserId }: { currentUserId: string }) {
  const { data: chats } = useFirestoreCollection<Chat>(tenantCol('core_chats'));
  const { data: users } = useFirestoreCollection<TenantUser>(tenantCol('core_users'));
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name || u.email || u.id));
    return map;
  }, [users]);

  const myChats = useMemo(
    () =>
      chats
        .filter((c) => c.participants?.includes(currentUserId))
        .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)),
    [chats, currentUserId],
  );

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'core_messages'),
      where('chatId', '==', activeChat),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Message[] = [];
      snap.forEach((d) => list.push(d.data() as Message));
      setMessages(list);
    });
    return unsub;
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat) return;
    const chat = chats.find((c) => c.id === activeChat);
    if (!chat?.unreadCounts?.[currentUserId]) return;
    const ref = tenantDoc('core_chats', activeChat);
    void updateDoc(ref, { [`unreadCounts.${currentUserId}`]: 0 });
  }, [activeChat, chats, currentUserId, messages.length]);

  const chatTitle = (chat: Chat) => {
    if (chat.title) return chat.title;
    if (chat.type === 'direct') {
      const other = chat.participants.find((p) => p !== currentUserId);
      return other ? userNameById.get(other) || 'Direct chat' : 'Direct chat';
    }
    return chat.id;
  };

  const unreadForChat = (chat: Chat) => chat.unreadCounts?.[currentUserId] || 0;

  const createChat = async () => {
    const participants = [...new Set([currentUserId, ...selectedParticipants])];
    if (participants.length < 2) return;
    setBusy(true);
    try {
      const id = `chat_${Date.now()}`;
      const isDirect = participants.length === 2;
      const title = isDirect ? undefined : groupTitle.trim() || 'Group chat';
      const unreadCounts: Record<string, number> = {};
      participants.forEach((p) => { unreadCounts[p] = 0; });

      await setDoc(tenantDoc('core_chats', id), {
        id,
        type: isDirect ? 'direct' : 'group',
        title,
        participants,
        unreadCounts,
        createdAt: Date.now(),
      });
      setActiveChat(id);
      setShowNewChat(false);
      setSelectedParticipants([]);
      setGroupTitle('');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!text.trim() || !activeChat) return;
    const chat = chats.find((c) => c.id === activeChat);
    if (!chat) return;

    const senderName = userNameById.get(currentUserId) || 'User';
    const payload = {
      id: `m_${Date.now()}`,
      chatId: activeChat,
      senderId: currentUserId,
      senderName,
      text: text.trim(),
      timestamp: Date.now(),
    };

    await addDoc(tenantCol('core_messages'), payload);

    const unreadCounts = { ...(chat.unreadCounts || {}) };
    chat.participants.forEach((p) => {
      if (p !== currentUserId) {
        unreadCounts[p] = (unreadCounts[p] || 0) + 1;
      }
    });
    unreadCounts[currentUserId] = 0;

    await updateDoc(tenantDoc('core_chats', activeChat), {
      lastMessage: { text: payload.text, senderId: currentUserId, timestamp: payload.timestamp },
      unreadCounts,
    });
    await logAudit('messenger_send', { chatId: activeChat });
    setText('');
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const otherUsers = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 bg-white p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-slate-500">Chats</h2>
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {myChats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChat(c.id)}
              className={`block w-full text-left p-2 rounded-lg text-sm mb-1 ${
                activeChat === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between gap-1">
                <span className="truncate font-medium">{chatTitle(c)}</span>
                {unreadForChat(c) > 0 && (
                  <span className="shrink-0 bg-blue-600 text-white text-[10px] px-1.5 rounded-full">
                    {unreadForChat(c)}
                  </span>
                )}
              </div>
              {c.lastMessage && (
                <div className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage.text}</div>
              )}
            </button>
          ))}
          {myChats.length === 0 && <p className="text-xs text-slate-400">No chats yet — start one.</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="px-4 py-2 border-b bg-white text-sm font-medium">
              {chatTitle(chats.find((c) => c.id === activeChat) || { id: activeChat, type: 'direct', participants: [] })}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                    m.senderId === currentUserId ? 'bg-blue-600 text-white' : 'bg-slate-100'
                  }`}>
                    {m.senderId !== currentUserId && (
                      <div className="text-[10px] opacity-70 mb-0.5">{m.senderName || m.senderId}</div>
                    )}
                    <div>{m.text}</div>
                    <div className={`text-[10px] mt-1 ${m.senderId === currentUserId ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex gap-2 bg-white">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                className="flex-1 p-2 border rounded-lg text-sm"
                placeholder="Type a message…"
              />
              <button type="button" onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Send</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">Select or start a chat</div>
        )}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
            <h3 className="font-bold mb-3">New conversation</h3>
            {selectedParticipants.length > 1 && (
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Group name (optional)"
                className="w-full p-2 border rounded-lg text-sm mb-3"
              />
            )}
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {otherUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                  />
                  {u.name || u.email || u.id}
                </label>
              ))}
              {otherUsers.length === 0 && (
                <p className="text-xs text-slate-400">Invite workspace members from Workspace Admin first.</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNewChat(false)} className="px-3 py-2 text-sm text-slate-500">Cancel</button>
              <button
                type="button"
                onClick={createChat}
                disabled={busy || selectedParticipants.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Start chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
