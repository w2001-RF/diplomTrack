import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, AlertCircle, Info, Clock, Check, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationsQuery } from '@/hooks/api';
import type { NotificationRow } from '@/lib/api/models';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Info className="h-5 w-5 text-primary" />;
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  return `Il y a ${diffDays}j`;
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const {
    notifications,
    unreadCount,
    loading,
    isRefetching,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationsQuery({ userId: user?.id });

  const handleNotificationClick = (notification: NotificationRow) => {
    if (notification.ticket_id) {
      navigate(`/dossier/${notification.ticket_id}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Notifications">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Notifications">
      {/* Refetching indicator */}
      {isRefetching && (
        <div className="fixed top-4 right-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2 z-50">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualisation...
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Centre de notifications</h2>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                  : 'Toutes les notifications sont lues'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
              <Check className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Récentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-4 opacity-50" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50',
                      !notification.is_read && 'bg-primary/5',
                      notification.ticket_id && 'cursor-pointer'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn(
                            'text-sm',
                            !notification.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <Badge variant="default" className="flex-shrink-0 text-xs">
                            Nouveau
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Marquer comme lu
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
