package com.bosguega.memoriaauxiliar

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

/**
 * Widget compacto "🧠 + Memória": apenas um botão.
 *
 * RemoteViews não aceita EditText em nenhum launcher — por isso o toque abre
 * a QuickCaptureActivity (diálogo de captura) em vez de expandir no próprio
 * widget. O widget nunca grava, nunca sincroniza e não conhece o PC.
 */
class MemoryWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (appWidgetId in appWidgetIds) {
            val intent = Intent(context, QuickCaptureActivity::class.java).apply {
                action = ACTION_QUICK_CAPTURE
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
            val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)

            val views = RemoteViews(context.packageName, R.layout.widget_memory)
            views.setOnClickPendingIntent(R.id.widgetRoot, pendingIntent)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    companion object {
        const val ACTION_QUICK_CAPTURE =
            "com.bosguega.memoriaauxiliar.action.QUICK_CAPTURE"
    }
}
