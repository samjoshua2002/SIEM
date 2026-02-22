#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define MAX_LINE 8192
#define ENDPOINT "http://localhost:3000/events"
#define CACHE_SIZE 10

typedef struct {
  int pid;
  char type[32];
  time_t timestamp;
} EventCache;

EventCache cache[CACHE_SIZE];
int cache_idx = 0;

int is_duplicate(int pid, const char *type) {
  time_t now = time(NULL);
  for (int i = 0; i < CACHE_SIZE; i++) {
    if (cache[i].pid == pid && strcmp(cache[i].type, type) == 0 &&
        (now - cache[i].timestamp) < 2) {
      return 1;
    }
  }
  cache[cache_idx].pid = pid;
  strcpy(cache[cache_idx].type, type);
  cache[cache_idx].timestamp = now;
  cache_idx = (cache_idx + 1) % CACHE_SIZE;
  return 0;
}

void escape_json(const char *input, char *output) {
  while (*input) {
    if (*input == '"' || *input == '\\') {
      *output++ = '\\';
    }
    *output++ = *input++;
  }
  *output = '\0';
}

void get_json_val(const char *json, const char *key, char *val, int max_len) {
  char search_key[256];
  snprintf(search_key, sizeof(search_key), "\"%s\":", key);
  char *pos = strstr(json, search_key);
  if (!pos)
    return;

  pos += strlen(search_key);
  while (*pos == ' ' || *pos == ':')
    pos++;

  if (*pos == '"') {
    pos++;
    char *end = strchr(pos, '"');
    if (end) {
      int len = end - pos;
      if (len >= max_len)
        len = max_len - 1;
      strncpy(val, pos, len);
      val[len] = '\0';
    }
  } else {
    char *end = strchr(pos, ',');
    if (!end)
      end = strchr(pos, '}');
    if (end) {
      int len = end - pos;
      if (len >= max_len)
        len = max_len - 1;
      strncpy(val, pos, len);
      val[len] = '\0';
    }
  }
}

void send_event(const char *event_type, const char *user, const char *command,
                const char *tty, const char *timestamp) {
  CURL *curl = curl_easy_init();
  if (curl) {
    char json_payload[MAX_LINE];
    char hostname[256];
    gethostname(hostname, sizeof(hostname));
    char safe_cmd[2048] = {0};
    escape_json(command, safe_cmd);

    snprintf(json_payload, sizeof(json_payload),
             "{\"event_type\": \"%s\", \"user\": \"%s\", \"command\": \"%s\", "
             "\"tty\": \"%s\", \"hostname\": \"%s\", \"timestamp\": \"%s\"}",
             event_type, user, safe_cmd, tty, hostname, timestamp);

    struct curl_slist *headers =
        curl_slist_append(NULL, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, ENDPOINT);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload);
    curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
  }
}

int main() {
  FILE *fp;
  char line[MAX_LINE];
  memset(cache, 0, sizeof(cache));

  printf("Starting Sentinel Log Security Agent (V4 - Anti-Spam)...\n");

  fp = popen("log stream --style ndjson --predicate 'process == \"sudo\" OR "
             "process == \"su\"'",
             "r");
  if (fp == NULL) {
    exit(1);
  }

  while (fgets(line, sizeof(line), fp) != NULL) {
    if (line[0] != '{')
      continue;

    char eventMessage[2048] = {0};
    char timestamp[64] = {0};
    char processPath[1024] = {0};
    char pid_str[32] = {0};

    get_json_val(line, "eventMessage", eventMessage, sizeof(eventMessage));
    get_json_val(line, "timestamp", timestamp, sizeof(timestamp));
    get_json_val(line, "processImagePath", processPath, sizeof(processPath));
    get_json_val(line, "processID", pid_str, sizeof(pid_str));
    int pid = atoi(pid_str);

    int is_auth_failure = (strstr(eventMessage, "incorrect") != NULL ||
                           strstr(eventMessage, "authtok") != NULL);

    if (strstr(eventMessage, "incorrect password attempt") != NULL) {
      is_auth_failure = 0;
    }
    int is_su_process = (strstr(processPath, "/su") != NULL);
    int is_sudo_process = (strstr(processPath, "/sudo") != NULL);

    char user[64] = "unknown";
    if (is_sudo_process) {
      char *u_start = strstr(eventMessage, "sudo: ");
      if (!u_start)
        u_start = strstr(eventMessage, "sudo:");
      if (u_start) {
        u_start += (u_start[5] == ' ' ? 6 : 5);
        char *u_end = strchr(u_start, ' ');
        if (!u_end)
          u_end = strchr(u_start, ':');
        if (u_end) {
          int len = u_end - u_start;
          if (len > 0 && len < 63) {
            strncpy(user, u_start, len);
            user[len] = '\0';
          }
        }
      }
    } else if (is_su_process) {
      strcpy(user, "root-attempt");
    }

    char command[1024] = "unknown";
    char *cmd_start = strstr(eventMessage, "COMMAND=");
    if (cmd_start) {
      cmd_start += 8;
      char *cmd_end = strchr(cmd_start, ';');
      if (!cmd_end)
        cmd_end = strchr(cmd_start, '\n');
      if (cmd_end) {
        strncpy(command, cmd_start, cmd_end - cmd_start);
      } else {
        strcpy(command, cmd_start);
      }
    } else if (is_su_process) {
      strcpy(command, "su shell (V4)");
    }

    char tty[64] = "unknown";
    char *tty_start = strstr(eventMessage, "TTY=");
    if (tty_start) {
      tty_start += 4;
      char *tty_end = strchr(tty_start, ' ');
      if (tty_end) {
        strncpy(tty, tty_start, tty_end - tty_start);
      }
    }

    if (is_auth_failure && !is_duplicate(pid, "auth_failure")) {
      printf("[LOG] Captured Unique Auth Failure for %s (PID: %d)\n", user,
             pid);
      send_event("auth_failure", user, command, tty, timestamp);
    } else if (is_su_process &&
               strstr(eventMessage, "Membership API: translate identifier") !=
                   NULL &&
               !is_duplicate(pid, "elevation")) {
      printf("[LOG] Captured Unique Root Elevation for %s (PID: %d)\n", user,
             pid);
      send_event("privilege_escalation", user, "su shell", tty, timestamp);
    }
  }
  return 0;
}
