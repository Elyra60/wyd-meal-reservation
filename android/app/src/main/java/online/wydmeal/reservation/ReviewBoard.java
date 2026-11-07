package online.wydmeal.reservation;

import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.graphics.Color;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

final class ReviewBoard {
    private static final ZoneId CHINA = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter LOCAL = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("yyyy年M月d日 HH:mm");

    static void render(MainActivity activity, JSONObject data) {
        NativeUi ui = activity.ui();
        LinearLayout parent = activity.body();
        JSONObject user = activity.user();
        boolean wang = "wang-yida".equals(user.optString("id"));
        ui.title(parent, "大众评审", "每人一票。到期同意票多于反对票时，王亦达可以吃。");
        boolean manager = "manager".equals(user.optString("role")) || user.optBoolean("canManage");
        if (wang || manager) ui.fullButton(parent, manager ? "新增评审" : "发起评审申请", true, () -> edit(activity, null));
        JSONArray reviews = MainActivity.arr(data, "reviews");
        if (reviews.length() == 0) ui.card(parent).addView(ui.body("暂无大众评审申请。"));
        for (int index = 0; index < reviews.length(); index++) {
            JSONObject review = reviews.optJSONObject(index);
            if (review != null) renderReview(activity, parent, review, wang, "user".equals(user.optString("role")), manager);
        }
    }

    private static void renderReview(MainActivity activity, LinearLayout parent, JSONObject review, boolean wang, boolean canComment, boolean manager) {
        NativeUi ui = activity.ui();
        LinearLayout card = ui.card(parent);
        String id = review.optString("id");
        String vote = MainActivity.s(review, "myVote");
        long deadline = review.optLong("deadline");
        boolean open = "open".equals(review.optString("result"));
        boolean allowed = "allowed".equals(review.optString("result"));
        int yesColor = Color.parseColor(ui.dark ? "#9DDDB0" : "#2F6846");
        int noColor = Color.parseColor(ui.dark ? "#FFB8BD" : "#94414A");
        int yesSurface = Color.parseColor(ui.dark ? "#233B2D" : "#E8F3E9");
        int noSurface = Color.parseColor(ui.dark ? "#482930" : "#FAEDEE");
        int statusColor = open ? Color.parseColor(ui.dark ? "#F0D079" : "#806018") : allowed ? yesColor : noColor;
        int statusSurface = open ? ui.tonal : allowed ? yesSurface : noSurface;
        TextView status = ui.text(open ? "投票中" : allowed ? "可以吃" : "不可以吃", 14, statusColor, true);
        status.setBackground(ui.shape(statusSurface, 18));
        status.setPadding(ui.dp(12), ui.dp(7), ui.dp(12), ui.dp(7));
        card.addView(status, new LinearLayout.LayoutParams(-2, -2));
        ui.gap(card, 12);
        card.addView(ui.text(review.optString("food"), 24, ui.text, true));
        ui.gap(card, 14);
        LinearLayout metrics = ui.row();
        metrics.setBaselineAligned(false);
        metric(ui, metrics, "预计热量", String.format(Locale.CHINA, "%,d 千卡", review.optInt("calories")), ui.primary, ui.tonal);
        TextView countdown = metric(ui, metrics, "剩余时间", "", ui.primary, ui.tonal);
        card.addView(metrics);
        ui.gap(card, 8);
        card.addView(ui.text("截止于 " + Instant.ofEpochMilli(deadline).atZone(CHINA).format(DISPLAY) + "（北京时间）", 13, ui.muted, false));
        ui.gap(card, 14);
        LinearLayout tally = ui.row();
        tally.setBaselineAligned(false);
        metric(ui, tally, "同意", review.optInt("yes") + " 票", yesColor, yesSurface);
        metric(ui, tally, "反对", review.optInt("no") + " 票", noColor, noSurface);
        card.addView(tally);
        LinearLayout voting = ui.column();
        card.addView(voting);
        if (open && !wang && vote.isEmpty()) {
            ui.fullButton(voting, "同意", true, () -> activity.reviewAction(ApiClient.object("action", "reviewVote", "id", id, "choice", "yes")));
            ui.fullButton(voting, "反对", false, () -> activity.reviewAction(ApiClient.object("action", "reviewVote", "id", id, "choice", "no")));
        }
        Runnable tick = new Runnable() {
            @Override public void run() {
                long seconds = Math.max(0, (deadline - System.currentTimeMillis() + 999) / 1000);
                if (!open || seconds == 0) {
                    countdown.setText("已截止");
                    if (open) status.setText("正在结算");
                    voting.setVisibility(View.GONE);
                    return;
                }
                countdown.setText(String.format(Locale.ROOT, "%02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60));
                if (countdown.isAttachedToWindow()) countdown.postDelayed(this, 1000);
            }
        };
        countdown.post(tick);
        if (!vote.isEmpty()) card.addView(ui.body("你已投" + ("yes".equals(vote) ? "同意" : "反对") + "票"));
        if (manager) {
            ui.fullButton(card, "修改评审", false, () -> edit(activity, review));
            ui.fullButton(card, "删除评审", false, () -> new AlertDialog.Builder(activity)
                .setTitle("删除这条评审？").setMessage("该评审的投票与留言也会删除。")
                .setNegativeButton("取消", null).setPositiveButton("删除", (dialog, which) ->
                    activity.reviewAction(ApiClient.object("action", "reviewDelete", "id", id))).show());
        }
        ui.gap(card, 12);
        LinearLayout thread = ui.column();
        thread.setPadding(ui.dp(14), ui.dp(12), ui.dp(14), ui.dp(12));
        thread.setBackground(ui.shape(ui.bg, 14));
        card.addView(thread, new LinearLayout.LayoutParams(-1, -2));
        JSONArray comments = MainActivity.arr(review, "comments");
        thread.addView(ui.text("公开留言 · " + comments.length(), 16, ui.text, true));
        if (comments.length() == 0) thread.addView(ui.text("还没有留言。", 14, ui.muted, false));
        for (int index = 0; index < comments.length(); index++) {
            JSONObject comment = comments.optJSONObject(index);
            if (comment == null) continue;
            ui.gap(thread, 12);
            commentRow(activity, thread, comment);
        }
        if (canComment && !vote.isEmpty()) ui.fullButton(card, "写留言", false, () -> comment(activity, id));
    }

    private static TextView metric(NativeUi ui, LinearLayout row, String label, String value, int color, int surface) {
        LinearLayout block = ui.column();
        block.setPadding(ui.dp(10), ui.dp(10), ui.dp(10), ui.dp(10));
        block.setBackground(ui.shape(surface, 12));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, -1, 1);
        if (row.getChildCount() == 0) params.rightMargin = ui.dp(8);
        row.addView(block, params);
        block.addView(ui.text(label, 12, ui.muted, true));
        ui.gap(block, 4);
        TextView number = ui.text(value, 18, color, true);
        block.addView(number);
        return number;
    }

    private static void commentRow(MainActivity activity, LinearLayout thread, JSONObject comment) {
        NativeUi ui = activity.ui();
        String author = comment.optString("author", "用户");
        LinearLayout row = ui.row();
        row.setGravity(Gravity.TOP);
        row.setBaselineAligned(false);
        FrameLayout avatar = new FrameLayout(activity);
        avatar.setBackground(ui.shape(ui.tonal, 18));
        avatar.setClipToOutline(true);
        String first = author.isEmpty() ? "用" : new String(Character.toChars(author.codePointAt(0)));
        TextView initial = ui.text(first, 14, ui.primary, true);
        initial.setGravity(Gravity.CENTER);
        avatar.addView(initial, new FrameLayout.LayoutParams(-1, -1));
        ImageView picture = new ImageView(activity);
        picture.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatar.addView(picture, new FrameLayout.LayoutParams(-1, -1));
        activity.loadReviewAvatar(MainActivity.s(comment, "avatarUrl"), picture);
        LinearLayout.LayoutParams avatarSize = new LinearLayout.LayoutParams(ui.dp(34), ui.dp(34));
        avatarSize.rightMargin = ui.dp(10);
        row.addView(avatar, avatarSize);
        LinearLayout text = ui.column();
        text.addView(ui.text(author, 14, ui.primary, true));
        text.addView(ui.body(comment.optString("body")));
        row.addView(text, new LinearLayout.LayoutParams(0, -2, 1));
        thread.addView(row, new LinearLayout.LayoutParams(-1, -2));
    }

    private static LinearLayout dialogBody(MainActivity activity) {
        NativeUi ui = activity.ui();
        LinearLayout box = ui.column();
        box.setPadding(ui.dp(24), ui.dp(6), ui.dp(24), ui.dp(8));
        return box;
    }

    private static void edit(MainActivity activity, JSONObject review) {
        NativeUi ui = activity.ui();
        LinearLayout box = dialogBody(activity);
        EditText food = ui.input(box, "食物名称", MainActivity.s(review, "food"), InputType.TYPE_CLASS_TEXT);
        EditText calories = ui.input(box, "热量 · 千卡", MainActivity.s(review, "calories"), InputType.TYPE_CLASS_NUMBER);
        LocalDateTime[] deadline = {review == null ? LocalDateTime.now(CHINA).plusHours(1).withSecond(0).withNano(0)
            : LocalDateTime.ofInstant(Instant.ofEpochMilli(review.optLong("deadline")), CHINA)};
        TextView dateLabel = ui.body(deadline[0].format(DISPLAY) + "（北京时间）");
        box.addView(dateLabel);
        ui.fullButton(box, "选择截止日期和时间", false, () -> {
            LocalDateTime date = deadline[0];
            new DatePickerDialog(activity, (picker, year, month, day) ->
                new TimePickerDialog(activity, (clock, hour, minute) -> {
                    deadline[0] = LocalDateTime.of(year, month + 1, day, hour, minute);
                    dateLabel.setText(deadline[0].format(DISPLAY) + "（北京时间）");
                }, date.getHour(), date.getMinute(), true).show(),
                date.getYear(), date.getMonthValue() - 1, date.getDayOfMonth()).show();
        });
        if (review != null && !"open".equals(review.optString("result"))) {
            box.addView(ui.body("把截止时间改到未来会恢复投票，已有投票与留言会保留。"));
        }
        android.widget.ScrollView scroller = new android.widget.ScrollView(activity);
        scroller.addView(box);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle(review == null ? "新增大众评审" : "修改大众评审").setView(scroller)
            .setNegativeButton("返回", null).setPositiveButton(review == null ? "提交申请" : "保存修改", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String name = food.getText().toString().trim();
            if (name.isEmpty() || name.length() > 100) { food.setError("请填写 1–100 字的食物名称"); return; }
            String amount = calories.getText().toString().trim();
            if (!amount.matches("[0-9]{1,6}") || Integer.parseInt(amount) < 1 || Integer.parseInt(amount) > 100000) {
                calories.setError("请输入 1–100000 千卡"); return;
            }
            if (review == null && !deadline[0].isAfter(LocalDateTime.now(CHINA))) { activity.notifyError("请选择未来截止时间。"); return; }
            dialog.dismiss();
            activity.reviewAction(ApiClient.object("action", review == null ? "reviewCreate" : "reviewEdit",
                "id", MainActivity.s(review, "id"), "food", name, "calories", amount, "deadline", deadline[0].format(LOCAL)));
        }));
        dialog.show();
    }

    private static void comment(MainActivity activity, String id) {
        LinearLayout box = dialogBody(activity);
        EditText text = activity.ui().input(box, "留言内容", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("公开留言").setView(box)
            .setNegativeButton("返回", null).setPositiveButton("发布留言", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String body = text.getText().toString().trim();
            if (body.isEmpty() || body.length() > 500) { text.setError("请填写 1–500 字的留言"); return; }
            dialog.dismiss();
            activity.reviewAction(ApiClient.object("action", "reviewComment", "id", id, "body", body));
        }));
        dialog.show();
    }
}
