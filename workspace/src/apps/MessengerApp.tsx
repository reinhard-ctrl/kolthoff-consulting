import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  increment,
} from 'firebase/firestore';
import { db, tenantCol, tenantDoc, logAudit, getWorkspaceTenantId, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  timestamp: number;
  deleted?: boolean;
  editedAt?: number;
  replyToId?: string;
  replyToText?: string;
}

interface Chat {
  id: string;
  type: string;
  title?: string;
  participants: string[];
  participantKey?: string;
  lastMessage?: { text: string; senderId: string; timestamp: number };
  unreadCounts?: Record<string, number>;
  archivedBy?: string[];
  mutedBy?: string[];
  typing?: Record<string, number>;
  readAt?: Record<string, number>;
}

interface TenantUser {
  id: string;
  name?: string;
  email?: string;
}

function directParticipantKey(a: string, b: string): string {
  return [a, b].sort().join('__');
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
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [addMemberId, setAddMemberId] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name || u.email || u.id));
    return map;
  }, [users]);

  const myChats = useMemo(() => {
    return chats
      .filter((c) => c.participants?.includes(currentUserId))
      .filter((c) => {
        const archived = c.archivedBy?.includes(currentUserId);
        return showArchived ? archived : !archived;
      })
      .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  }, [chats, currentUserId, showArchived]);

  const activeChatDoc = chats.find((c) => c.id === activeChat) || null;

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => !m.deleted && (m.text || '').toLowerCase().includes(q));
  }, [messages, search]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const tenantId = getWorkspaceTenantId();
    if (!tenantId) return;
    const q = query(
      collection(db, 'artifacts', tenantId, 'public', 'data', 'core_messages'),
      where('chatId', '==', activeChat),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Message[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }));
      setMessages(list);
    });
    return unsub;
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat) return;
    const chat = chats.find((c) => c.id === activeChat);
    if (!chat) return;
    void updateDoc(tenantDoc('core_chats', activeChat), {
      [`unreadCounts.${currentUserId}`]: 0,
      [`readAt.${currentUserId}`]: Date.now(),
    }).catch(() => undefined);
  }, [activeChat, chats, currentUserId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length, activeChat]);

  const chatTitle = (chat: Chat) => {
    if (chat.title) return chat.title;
    if (chat.type === 'direct') {
      const other = chat.participants.find((p) => p !== currentUserId);
      return other ? userNameById.get(other) || 'Direct chat' : 'Direct chat';
    }
    return chat.id;
  };

  const unreadForChat = (chat: Chat) => chat.unreadCounts?.[currentUserId] || 0;

  const someoneTyping = useMemo(() => {
    if (!activeChatDoc?.typing) return null;
    const now = Date.now();
    for (const [uid, at] of Object.entries(activeChatDoc.typing)) {
      if (uid !== currentUserId && typeof at === 'number' && now - at < 4000) {
        return userNameById.get(uid) || 'Someone';
      }
    }
    return null;
  }, [activeChatDoc, currentUserId, userNameById]);

  const pulseTyping = async () => {
    if (!activeChat) return;
    try {
      await updateDoc(tenantDoc('core_chats', activeChat), {
        [`typing.${currentUserId}`]: Date.now(),
      });
    } catch {
      /* ignore */
    }
  };

  const onTextChange = (value: string) => {
    setText(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    void pulseTyping();
    typingTimer.current = setTimeout(() => {
      if (!activeChat) return;
      void updateDoc(tenantDoc('core_chats', activeChat), {
        [`typing.${currentUserId}`]: 0,
      }).catch(() => undefined);
    }, 2500);
  };

  const createChat = async () => {
    const participants = [...new Set([currentUserId, ...selectedParticipants])];
    if (participants.length < 2) return;
    setBusy(true);
    try {
      const isDirect = participants.length === 2;
      if (isDirect) {
        const key = directParticipantKey(participants[0], participants[1]);
        const existing = chats.find(
          (c) => c.type === 'direct' && (c.participantKey === key || (
            c.participants.length === 2 &&
            c.participants.includes(participants[0]) &&
            c.participants.includes(participants[1])
          )),
        );
        if (existing) {
          setActiveChat(existing.id);
          setShowNewChat(false);
          setSelectedParticipants([]);
          return;
        }
      }

      const id = `chat_${Date.now()}`;
      const title = isDirect ? undefined : groupTitle.trim() || 'Group chat';
      const unreadCounts: Record<string, number> = {};
      participants.forEach((p) => { unreadCounts[p] = 0; });

      await setDoc(tenantDoc('core_chats', id), {
        id,
        type: isDirect ? 'direct' : 'group',
        title,
        participants,
        participantKey: isDirect ? directParticipantKey(participants[0], participants[1]) : null,
        unreadCounts,
        archivedBy: [],
        mutedBy: [],
        typing: {},
        readAt: {},
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

  const send = async (payload?: { text?: string; type?: string; fileUrl?: string; fileName?: string }) => {
    const messageText = payload?.text ?? text;
    if ((!messageText?.trim() && !payload?.fileUrl) || !activeChat) return;
    const chat = chats.find((c) => c.id === activeChat);
    if (!chat) return;

    const senderName = userNameById.get(currentUserId) || 'User';
    const body = {
      chatId: activeChat,
      senderId: currentUserId,
      senderName,
      text: messageText?.trim() || payload?.fileName || 'Attachment',
      type: payload?.type || 'text',
      fileUrl: payload?.fileUrl || null,
      fileName: payload?.fileName || null,
      replyToId: replyTo?.id || null,
      replyToText: replyTo?.text?.slice(0, 120) || null,
      timestamp: Date.now(),
      deleted: false,
    };

    await addDoc(tenantCol('core_messages'), body);

    const unreadPatch: Record<string, unknown> = {
      lastMessage: { text: body.text, senderId: currentUserId, timestamp: body.timestamp },
      [`unreadCounts.${currentUserId}`]: 0,
      [`typing.${currentUserId}`]: 0,
      [`readAt.${currentUserId}`]: Date.now(),
    };
    chat.participants.forEach((p) => {
      if (p !== currentUserId && !chat.mutedBy?.includes(p)) {
        unreadPatch[`unreadCounts.${p}`] = increment(1);
      }
    });

    await updateDoc(tenantDoc('core_chats', activeChat), unreadPatch);
    await logAudit('messenger_send', { chatId: activeChat, type: body.type });
    setText('');
    setReplyTo(null);
  };

  const uploadFile = async (file: File) => {
    if (!activeChat || !file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const tenantId = getWorkspaceTenantId();
      if (!tenantId) return;
      const path = `artifacts/${tenantId}/files/messenger/${activeChat}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      await send({ type: 'file', fileUrl, fileName: file.name, text: file.name });
    } finally {
      setUploading(false);
    }
  };

  const softDelete = async (message: Message) => {
    if (message.senderId !== currentUserId) return;
    if (Date.now() - message.timestamp > 15 * 60 * 1000) {
      window.alert('You can only delete messages within 15 minutes.');
      return;
    }
    await updateDoc(tenantDoc('core_messages', message.id), {
      deleted: true,
      text: 'Message deleted',
      fileUrl: null,
    });
  };

  const toggleArchive = async () => {
    if (!activeChatDoc) return;
    const archived = activeChatDoc.archivedBy || [];
    const next = archived.includes(currentUserId)
      ? archived.filter((id) => id !== currentUserId)
      : [...archived, currentUserId];
    await updateDoc(tenantDoc('core_chats', activeChatDoc.id), { archivedBy: next });
  };

  const toggleMute = async () => {
    if (!activeChatDoc) return;
    const muted = activeChatDoc.mutedBy || [];
    const next = muted.includes(currentUserId)
      ? muted.filter((id) => id !== currentUserId)
      : [...muted, currentUserId];
    await updateDoc(tenantDoc('core_chats', activeChatDoc.id), { mutedBy: next });
  };

  const addMember = async () => {
    if (!activeChatDoc || !addMemberId || activeChatDoc.type !== 'group') return;
    if (activeChatDoc.participants.includes(addMemberId)) return;
    await updateDoc(tenantDoc('core_chats', activeChatDoc.id), {
      participants: [...activeChatDoc.participants, addMemberId],
      [`unreadCounts.${addMemberId}`]: 0,
    });
    setAddMemberId('');
  };

  const removeMember = async (userId: string) => {
    if (!activeChatDoc || activeChatDoc.type !== 'group' || userId === currentUserId) return;
    await updateDoc(tenantDoc('core_chats', activeChatDoc.id), {
      participants: activeChatDoc.participants.filter((id) => id !== userId),
    });
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const otherUsers = users.filter((u) => u.id !== currentUserId);
  const lastReadByOthers = useMemo(() => {
    if (!activeChatDoc?.readAt || !activeChatDoc.lastMessage) return false;
    if (activeChatDoc.lastMessage.senderId !== currentUserId) return false;
    return activeChatDoc.participants.some(
      (p) => p !== currentUserId && (activeChatDoc.readAt?.[p] || 0) >= activeChatDoc.lastMessage!.timestamp,
    );
  }, [activeChatDoc, currentUserId]);

  return (
    <div className="flex h-full">
      <div className="w-64 md:w-72 border-r border-slate-200 bg-white/90 p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-slate-600 tracking-wide uppercase">Messenger</h2>
          <button type="button" onClick={() => setShowNewChat(true)} className="text-xs px-2 py-1 bg-brandTeal-500 text-slate-950 font-semibold rounded-lg">
            + New
          </button>
        </div>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`text-[11px] px-2 py-1 rounded ${!showArchived ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`text-[11px] px-2 py-1 rounded ${showArchived ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            Archived
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {myChats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setActiveChat(c.id); setSearch(''); setReplyTo(null); }}
              className={`block w-full text-left p-2.5 rounded-xl text-sm mb-1 transition-colors ${
                activeChat === c.id ? 'bg-brandTeal-500/15 text-slate-900' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between gap-1">
                <span className="truncate font-medium">{chatTitle(c)}</span>
                {unreadForChat(c) > 0 && (
                  <span className="shrink-0 bg-brandTeal-500 text-slate-950 text-[10px] font-bold px-1.5 rounded-full">
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

      <div className="flex-1 flex flex-col min-w-0">
        {activeChat && activeChatDoc ? (
          <>
            <div className="px-4 py-2 border-b bg-white/90 flex flex-wrap items-center gap-2 justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{chatTitle(activeChatDoc)}</div>
                <div className="text-[11px] text-slate-500">
                  {activeChatDoc.participants.length} members
                  {activeChatDoc.mutedBy?.includes(currentUserId) ? ' · muted' : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages"
                  className="ws-input py-1 text-xs max-w-[10rem]"
                />
                <button type="button" onClick={toggleMute} className="ws-btn-secondary text-xs py-1 px-2">
                  {activeChatDoc.mutedBy?.includes(currentUserId) ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" onClick={toggleArchive} className="ws-btn-secondary text-xs py-1 px-2">
                  {activeChatDoc.archivedBy?.includes(currentUserId) ? 'Unarchive' : 'Archive'}
                </button>
              </div>
            </div>

            {activeChatDoc.type === 'group' && (
              <div className="px-4 py-2 border-b bg-slate-50/80 flex flex-wrap gap-2 items-center text-xs">
                <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="ws-input py-1 max-w-[12rem]">
                  <option value="">Add member…</option>
                  {otherUsers
                    .filter((u) => !activeChatDoc.participants.includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                </select>
                <button type="button" onClick={addMember} disabled={!addMemberId} className="ws-btn-secondary text-xs py-1 px-2 disabled:opacity-50">
                  Add
                </button>
                <div className="flex flex-wrap gap-1">
                  {activeChatDoc.participants.map((pid) => (
                    <span key={pid} className="inline-flex items-center gap-1 rounded bg-white border px-2 py-0.5">
                      {userNameById.get(pid) || pid}
                      {pid !== currentUserId && (
                        <button type="button" className="text-rose-500" onClick={() => removeMember(pid)} title="Remove">×</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredMessages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-sm group relative ${
                    m.senderId === currentUserId ? 'bg-brandNavy-900 text-white' : 'bg-white border border-slate-200'
                  } ${m.deleted ? 'opacity-60 italic' : ''}`}>
                    {m.senderId !== currentUserId && (
                      <div className="text-[10px] opacity-70 mb-0.5">{m.senderName || m.senderId}</div>
                    )}
                    {m.replyToText && (
                      <div className={`text-[11px] mb-1 border-l-2 pl-2 ${m.senderId === currentUserId ? 'border-brandTeal-400 text-slate-300' : 'border-slate-300 text-slate-500'}`}>
                        {m.replyToText}
                      </div>
                    )}
                    <div>{m.deleted ? 'Message deleted' : m.text}</div>
                    {m.type === 'file' && m.fileUrl && !m.deleted && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs underline mt-1 block ${m.senderId === currentUserId ? 'text-brandTeal-300' : 'text-brandTeal-600'}`}
                      >
                        {m.fileName || 'Download file'}
                      </a>
                    )}
                    <div className={`text-[10px] mt-1 flex items-center gap-2 ${m.senderId === currentUserId ? 'text-slate-400' : 'text-slate-400'}`}>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!m.deleted && (
                        <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => setReplyTo(m)}>Reply</button>
                      )}
                      {m.senderId === currentUserId && !m.deleted && (
                        <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => softDelete(m)}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-1 text-[11px] text-slate-500 min-h-[1.25rem]">
              {someoneTyping ? `${someoneTyping} is typing…` : lastReadByOthers ? 'Seen' : ''}
            </div>

            {replyTo && (
              <div className="px-3 py-2 border-t bg-slate-50 text-xs flex justify-between gap-2">
                <span className="truncate">Replying to: {replyTo.text}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-slate-500">Cancel</button>
              </div>
            )}

            <div className="p-3 border-t flex gap-2 bg-white items-center">
              <label className="px-2 py-2 border rounded-lg text-sm cursor-pointer hover:bg-slate-50 shrink-0">
                File
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <input
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
                className="ws-input flex-1"
                placeholder="Type a message…"
              />
              <button type="button" onClick={() => send()} disabled={uploading} className="ws-btn-primary disabled:opacity-50">
                {uploading ? '…' : 'Send'}
              </button>
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
                className="ws-input mb-3"
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
              <button type="button" onClick={() => setShowNewChat(false)} className="ws-btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={createChat}
                disabled={busy || selectedParticipants.length === 0}
                className="ws-btn-primary disabled:opacity-50"
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
