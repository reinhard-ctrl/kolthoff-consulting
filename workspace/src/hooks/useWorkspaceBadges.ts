import { useEffect, useState } from 'react';
import { auth, tenantCol } from '../lib/firebase';
import { useFirestoreCollection } from './useFirestoreCollection';
import { canActOnRequest, type ApprovalRequest } from '../lib/approval-workflow';

interface ChatRow {
  id: string;
  participants?: string[];
  unreadCounts?: Record<string, number>;
}

interface NotificationRow {
  id: string;
  userId: string;
  read?: boolean;
}

export function useWorkspaceBadges(currentUserId: string) {
  const { data: requests } = useFirestoreCollection<ApprovalRequest>(tenantCol('core_requests'));
  const { data: chats } = useFirestoreCollection<ChatRow>(tenantCol('core_chats'));
  const { data: notifications } = useFirestoreCollection<NotificationRow>(tenantCol('core_notifications'));
  const [firebaseUid, setFirebaseUid] = useState<string | undefined>(auth.currentUser?.uid);

  useEffect(() => {
    void auth.authStateReady().then(() => setFirebaseUid(auth.currentUser?.uid));
  }, []);

  const pendingApprovals = requests.filter(
    (r) => r.status === 'pending' && canActOnRequest(r, currentUserId, firebaseUid),
  ).length;

  const unreadMessages = chats
    .filter((c) => c.participants?.includes(currentUserId))
    .reduce((sum, c) => sum + (c.unreadCounts?.[currentUserId] || 0), 0);

  const unreadNotifications = notifications.filter(
    (n) => n.userId === currentUserId && !n.read,
  ).length;

  return {
    pendingApprovals: Math.max(pendingApprovals, unreadNotifications),
    unreadMessages,
  };
}
