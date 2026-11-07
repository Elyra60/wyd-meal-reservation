package online.wydmeal.reservation;

import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.text.InputType;
import android.widget.EditText;
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
        if (wang) ui.fullButton(parent, "发起评审申请", true, () -> create(activity));
        JSONArray reviews = MainActivity.arr(data, "reviews");
        if (reviews.length() == 0) ui.card(parent).addView(ui.body("暂无大众评审申请。"));
        for (int index = 0; index < reviews.length(); index++) {
            JSONObject review = reviews.optJSONObject(index);
            if (review != null) renderReview(activity, parent, review, wang, "user".equals(user.optString("role")));
        }
    }

    private static void renderReview(MainActivity activity, LinearLayout parent, JSONObject review, boolean wang, boolean canComment) {
        NativeUi ui = activity.ui();
        LinearLayout card = ui.card(parent);
        String id = review.optString("id");
        String vote = MainActivity.s(review, "myVote");
        long deadline = review.optLong("deadline");
        boolean open = "open".equals(review.optString("result"));
        boolean allowed = "allowed".equals(review.optString("result"));
        card.addView(ui.text(review.optString("food"), 21, ui.text, true));
        card.addView(ui.body(review.optInt("calories") + " 千卡"));
        TextView countdown = ui.text("", 17, ui.primary, true);
        ui.gap(card, 10);
        card.addView(countdown);
        card.addView(ui.text("截止于 " + Instant.ofEpochMilli(deadline).atZone(CHINA).format(DISPLAY) + "（北京时间）", 13, ui.muted, false));
        card.addView(ui.body("同意 " + review.optInt("yes") + " 票 · 反对 " + review.optInt("no") + " 票"));
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
                    countdown.setText(open ? "已截止 · 正在结算" : allowed ? "已截止 · 可以吃" : "已截止 · 不可以吃");
                    voting.setVisibility(android.view.View.GONE);
                    return;
                }
                countdown.setText(String.format(Locale.ROOT, "剩余 %02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60));
                if (countdown.isAttachedToWindow()) countdown.postDelayed(this, 1000);
            }
        };
        countdown.post(tick);
        if (!vote.isEmpty()) card.addView(ui.body("你已投" + ("yes".equals(vote) ? "同意" : "反对") + "票"));
        ui.gap(card, 12);
        card.addView(ui.text("公开留言", 16, ui.text, true));
        JSONArray comments = MainActivity.arr(review, "comments");
        if (comments.length() == 0) card.addView(ui.text("还没有留言。", 14, ui.muted, false));
        for (int index = 0; index < comments.length(); index++) {
            JSONObject comment = comments.optJSONObject(index);
            if (comment == null) continue;
            ui.gap(card, 8);
            card.addView(ui.text(comment.optString("author"), 14, ui.primary, true));
            card.addView(ui.body(comment.optString("body")));
        }
        if (canComment && !vote.isEmpty()) ui.fullButton(card, "写留言", false, () -> comment(activity, id));
    }

    private static LinearLayout dialogBody(MainActivity activity) {
        NativeUi ui = activity.ui();
        LinearLayout box = ui.column();
        box.setPadding(ui.dp(24), ui.dp(6), ui.dp(24), ui.dp(8));
        return box;
    }

    private static void create(MainActivity activity) {
        NativeUi ui = activity.ui();
        LinearLayout box = dialogBody(activity);
        EditText food = ui.input(box, "食物名称", "", InputType.TYPE_CLASS_TEXT);
        EditText calories = ui.input(box, "热量 · 千卡", "", InputType.TYPE_CLASS_NUMBER);
        LocalDateTime[] deadline = {LocalDateTime.now(CHINA).plusHours(1).withSecond(0).withNano(0)};
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
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("发起大众评审").setView(box)
            .setNegativeButton("返回", null).setPositiveButton("提交申请", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String name = food.getText().toString().trim();
            if (name.isEmpty() || name.length() > 100) { food.setError("请填写 1–100 字的食物名称"); return; }
            String amount = calories.getText().toString().trim();
            if (!amount.matches("[0-9]{1,6}") || Integer.parseInt(amount) < 1 || Integer.parseInt(amount) > 100000) {
                calories.setError("请输入 1–100000 千卡"); return;
            }
            if (!deadline[0].isAfter(LocalDateTime.now(CHINA))) { activity.notifyError("请选择未来截止时间。"); return; }
            dialog.dismiss();
            activity.reviewAction(ApiClient.object("action", "reviewCreate", "food", name, "calories", amount, "deadline", deadline[0].format(LOCAL)));
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
