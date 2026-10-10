// Frozen contract: originally generated from the Python reference core (retired in 0.5.0); checked by scripts/gen-golden.ts. Do not edit by hand.
export default {
 "merges": [
  {
   "options": {},
   "project": null,
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "mode": "assist"
   },
   "project": null,
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "assist",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "enable_all_projects": true
   },
   "project": null,
   "expected": {
    "schemaVersion": 1,
    "enabled": true,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "mode": "assist",
    "backend": "jev"
   },
   "project": {
    "mode": "observe"
   },
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "jev",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "mode": "bogus",
    "minimum_chars": 5000
   },
   "project": null,
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 5000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "minimum_chars": 999999999
   },
   "project": null,
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {
    "keep_threshold": 0.5,
    "retention_days": 14
   },
   "project": {
    "enabled": true
   },
   "expected": {
    "schemaVersion": 1,
    "enabled": true,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.5,
    "retentionDays": 14
   }
  },
  {
   "options": {
    "enable_all_projects": true
   },
   "project": {
    "enabled": false
   },
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 8000,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  },
  {
   "options": {},
   "project": {
    "endpoint": "https://evil.example"
   },
   "expected": {
    "error": "unsupported_config_fields"
   }
  },
  {
   "options": {
    "retention_days": 0
   },
   "project": {
    "minimumChars": 100
   },
   "expected": {
    "schemaVersion": 1,
    "enabled": false,
    "mode": "observe",
    "backend": "rules",
    "minimumChars": 100,
    "timeoutSeconds": 3.0,
    "keepThreshold": 0.8,
    "retentionDays": 7
   }
  }
 ],
 "redactions": [
  {
   "input": "Authorization: Bearer abcdefSECRET123",
   "expected": "[REDACTED]"
  },
  {
   "input": "{\"api_key\": \"SECRETJSON123\", \"password\":\"PW99\"}",
   "expected": "{\"[REDACTED], \"[REDACTED]}"
  },
  {
   "input": "password: \"quoted secret\"",
   "expected": "[REDACTED]"
  },
  {
   "input": "token='single quoted value' next",
   "expected": "[REDACTED] next"
  },
  {
   "input": "curl -H \"Authorization: Basic dXNlcjpwYXNz1234\" url",
   "expected": "curl -H \"[REDACTED]\" url"
  },
  {
   "input": "sk-abcdefghijklmnop and ghp_abcdefghijklmnop and AKIAABCDEFGHIJKLMNOP",
   "expected": "[REDACTED] and [REDACTED] and [REDACTED]"
  },
  {
   "input": "plain text with no secrets: tokenizer is fine",
   "expected": "plain text with no secrets: tokenizer is fine"
  }
 ],
 "digests": {
  "session-golden": "1aea5e8e5261dfc4dde04afa",
  "/work/project": "1203c54a2299cb55dc87dd63",
  "/tmp/données 日本語\"quote": "ea3f8d222247cc07e8cfad09"
 },
 "cases": [
  {
   "name": "long-with-error",
   "input": "progress item 0\nprogress item 1\nprogress item 2\nprogress item 3\nprogress item 4\nprogress item 5\nprogress item 6\nprogress item 7\nprogress item 8\nprogress item 9\nprogress item 10\nprogress item 11\nprogress item 12\nprogress item 13\nprogress item 14\nprogress item 15\nprogress item 16\nprogress item 17\nprogress item 18\nprogress item 19\nprogress item 20\nprogress item 21\nprogress item 22\nprogress item 23\nprogress item 24\nprogress item 25\nprogress item 26\nprogress item 27\nprogress item 28\nprogress item 29\nprogress item 30\nprogress item 31\nprogress item 32\nprogress item 33\nprogress item 34\nprogress item 35\nprogress item 36\nprogress item 37\nprogress item 38\nprogress item 39\nprogress item 40\nprogress item 41\nprogress item 42\nprogress item 43\nprogress item 44\nprogress item 45\nprogress item 46\nprogress item 47\nprogress item 48\nprogress item 49\nprogress item 50\nprogress item 51\nprogress item 52\nprogress item 53\nprogress item 54\nprogress item 55\nprogress item 56\nprogress item 57\nprogress item 58\nprogress item 59\nprogress item 60\nprogress item 61\nprogress item 62\nprogress item 63\nprogress item 64\nprogress item 65\nprogress item 66\nprogress item 67\nprogress item 68\nprogress item 69\nprogress item 70\nprogress item 71\nprogress item 72\nprogress item 73\nprogress item 74\nprogress item 75\nprogress item 76\nprogress item 77\nprogress item 78\nprogress item 79\nprogress item 80\nprogress item 81\nprogress item 82\nprogress item 83\nprogress item 84\nprogress item 85\nprogress item 86\nprogress item 87\nprogress item 88\nprogress item 89\nprogress item 90\nprogress item 91\nprogress item 92\nprogress item 93\nprogress item 94\nprogress item 95\nprogress item 96\nprogress item 97\nprogress item 98\nprogress item 99\nprogress item 100\nprogress item 101\nprogress item 102\nprogress item 103\nprogress item 104\nprogress item 105\nprogress item 106\nprogress item 107\nprogress item 108\nprogress item 109\nprogress item 110\nprogress item 111\nprogress item 112\nprogress item 113\nprogress item 114\nprogress item 115\nprogress item 116\nprogress item 117\nprogress item 118\nprogress item 119\nprogress item 120\nprogress item 121\nprogress item 122\nprogress item 123\nprogress item 124\nprogress item 125\nprogress item 126\nprogress item 127\nprogress item 128\nprogress item 129\nprogress item 130\nprogress item 131\nprogress item 132\nprogress item 133\nprogress item 134\nprogress item 135\nprogress item 136\nprogress item 137\nprogress item 138\nprogress item 139\nprogress item 140\nERROR build: expected contract 1, got invalid\nprogress item 142\nprogress item 143\nprogress item 144\nprogress item 145\nprogress item 146\nprogress item 147\nprogress item 148\nprogress item 149\nprogress item 150\nprogress item 151\nprogress item 152\nprogress item 153\nprogress item 154\nprogress item 155\nprogress item 156\nprogress item 157\nprogress item 158\nprogress item 159\nprogress item 160\nprogress item 161\nprogress item 162\nprogress item 163\nprogress item 164\nprogress item 165\nprogress item 166\nprogress item 167\nprogress item 168\nprogress item 169\nprogress item 170\nprogress item 171\nprogress item 172\nprogress item 173\nprogress item 174\nprogress item 175\nprogress item 176\nprogress item 177\nprogress item 178\nprogress item 179\nprogress item 180\nprogress item 181\nprogress item 182\nprogress item 183\nprogress item 184\nprogress item 185\nprogress item 186\nprogress item 187\nprogress item 188\nprogress item 189\nprogress item 190\nprogress item 191\nprogress item 192\nprogress item 193\nprogress item 194\nprogress item 195\nprogress item 196\nprogress item 197\nprogress item 198\nprogress item 199\nprogress item 200\nprogress item 201\nprogress item 202\nprogress item 203\nprogress item 204\nprogress item 205\nprogress item 206\nprogress item 207\nprogress item 208\nprogress item 209\nprogress item 210\nprogress item 211\nprogress item 212\nprogress item 213\nprogress item 214\nprogress item 215\nprogress item 216\nprogress item 217\nprogress item 218\nprogress item 219\nprogress item 220\nprogress item 221\nprogress item 222\nprogress item 223\nprogress item 224\nprogress item 225\nprogress item 226\nprogress item 227\nprogress item 228\nprogress item 229\nprogress item 230\nprogress item 231\nprogress item 232\nprogress item 233\nprogress item 234\nprogress item 235\nprogress item 236\nprogress item 237\nprogress item 238\nprogress item 239\nprogress item 240\nprogress item 241\nprogress item 242\nprogress item 243\nprogress item 244\nprogress item 245\nprogress item 246\nprogress item 247\nprogress item 248\nprogress item 249\nprogress item 250\nprogress item 251\nprogress item 252\nprogress item 253\nprogress item 254\nprogress item 255\nprogress item 256\nprogress item 257\nprogress item 258\nprogress item 259\nprogress item 260\nprogress item 261\nprogress item 262\nprogress item 263\nprogress item 264\nprogress item 265\nprogress item 266\nprogress item 267\nprogress item 268\nprogress item 269\nprogress item 270\nprogress item 271\nprogress item 272\nprogress item 273\nprogress item 274\nprogress item 275\nprogress item 276\nprogress item 277\nprogress item 278\nprogress item 279\nprogress item 280\nprogress item 281\nprogress item 282\nprogress item 283\nprogress item 284\nprogress item 285\nprogress item 286\nprogress item 287\nprogress item 288\nprogress item 289\nprogress item 290\nprogress item 291\nprogress item 292\nprogress item 293\nprogress item 294\nprogress item 295\nprogress item 296\nprogress item 297\nprogress item 298\nprogress item 299\nprogress item 300\nprogress item 301\nprogress item 302\nprogress item 303\nprogress item 304\nprogress item 305\nprogress item 306\nprogress item 307\nprogress item 308\nprogress item 309\nprogress item 310\nprogress item 311\nprogress item 312\nprogress item 313\nprogress item 314\nprogress item 315\nprogress item 316\nprogress item 317\nprogress item 318\nprogress item 319\n",
   "expected_output": "progress item 0\nprogress item 1\nprogress item 2\nprogress item 3\nprogress item 4\nprogress item 5\nprogress item 6\nprogress item 7\nprogress item 8\nprogress item 9\nprogress item 10\nprogress item 11\nprogress item 12\nprogress item 13\nprogress item 14\nprogress item 15\n[omitted original lines; use readback for the full log]\nprogress item 128\nprogress item 129\nprogress item 130\nprogress item 131\nprogress item 132\nprogress item 133\nprogress item 134\nprogress item 135\nprogress item 136\nprogress item 137\nprogress item 138\nprogress item 139\nprogress item 140\nERROR build: expected contract 1, got invalid\nprogress item 142\nprogress item 143\nprogress item 144\nprogress item 145\nprogress item 146\nprogress item 147\nprogress item 148\nprogress item 149\nprogress item 150\nprogress item 151\n[omitted original lines; use readback for the full log]\nprogress item 304\nprogress item 305\nprogress item 306\nprogress item 307\nprogress item 308\nprogress item 309\nprogress item 310\nprogress item 311\nprogress item 312\nprogress item 313\nprogress item 314\nprogress item 315\nprogress item 316\nprogress item 317\nprogress item 318\nprogress item 319\n",
   "expected_input_chars": 5678,
   "expected_reason": "ok"
  },
  {
   "name": "crlf-and-unicode",
   "input": "步驟 0 ok\r\n步驟 1 ok\r\n步驟 2 ok\r\n步驟 3 ok\r\n步驟 4 ok\r\n步驟 5 ok\r\n步驟 6 ok\r\n步驟 7 ok\r\n步驟 8 ok\r\n步驟 9 ok\r\n步驟 10 ok\r\n步驟 11 ok\r\n步驟 12 ok\r\n步驟 13 ok\r\n步驟 14 ok\r\n步驟 15 ok\r\n步驟 16 ok\r\n步驟 17 ok\r\n步驟 18 ok\r\n步驟 19 ok\r\n步驟 20 ok\r\n步驟 21 ok\r\n步驟 22 ok\r\n步驟 23 ok\r\n步驟 24 ok\r\n步驟 25 ok\r\n步驟 26 ok\r\n步驟 27 ok\r\n步驟 28 ok\r\n步驟 29 ok\r\n步驟 30 ok\r\n步驟 31 ok\r\n步驟 32 ok\r\n步驟 33 ok\r\n步驟 34 ok\r\n步驟 35 ok\r\n步驟 36 ok\r\n步驟 37 ok\r\n步驟 38 ok\r\n步驟 39 ok\r\n步驟 40 ok\r\n步驟 41 ok\r\n步驟 42 ok\r\n步驟 43 ok\r\n步驟 44 ok\r\n步驟 45 ok\r\n步驟 46 ok\r\n步驟 47 ok\r\n步驟 48 ok\r\n步驟 49 ok\r\n步驟 50 ok\r\n步驟 51 ok\r\n步驟 52 ok\r\n步驟 53 ok\r\n步驟 54 ok\r\n步驟 55 ok\r\n步驟 56 ok\r\n步驟 57 ok\r\n步驟 58 ok\r\n步驟 59 ok\r\n步驟 60 ok\r\n步驟 61 ok\r\n步驟 62 ok\r\n步驟 63 ok\r\n步驟 64 ok\r\n步驟 65 ok\r\n步驟 66 ok\r\n步驟 67 ok\r\n步驟 68 ok\r\n步驟 69 ok\r\n步驟 70 ok\r\n步驟 71 ok\r\n步驟 72 ok\r\n步驟 73 ok\r\n步驟 74 ok\r\n步驟 75 ok\r\n步驟 76 ok\r\n步驟 77 ok\r\n步驟 78 ok\r\n步驟 79 ok\r\n步驟 80 ok\r\n步驟 81 ok\r\n步驟 82 ok\r\n步驟 83 ok\r\n步驟 84 ok\r\n步驟 85 ok\r\n步驟 86 ok\r\n步驟 87 ok\r\n步驟 88 ok\r\n步驟 89 ok\r\n步驟 90 ok\r\n步驟 91 ok\r\n步驟 92 ok\r\n步驟 93 ok\r\n步驟 94 ok\r\n步驟 95 ok\r\n步驟 96 ok\r\n步驟 97 ok\r\n步驟 98 ok\r\n步驟 99 ok\r\nTraceback (most recent call last):\r\n  File \"x.py\", line 1\r\nValueError: 壞了\r\n步驟 100 ok\r\n步驟 101 ok\r\n步驟 102 ok\r\n步驟 103 ok\r\n步驟 104 ok\r\n步驟 105 ok\r\n步驟 106 ok\r\n步驟 107 ok\r\n步驟 108 ok\r\n步驟 109 ok\r\n步驟 110 ok\r\n步驟 111 ok\r\n步驟 112 ok\r\n步驟 113 ok\r\n步驟 114 ok\r\n步驟 115 ok\r\n步驟 116 ok\r\n步驟 117 ok\r\n步驟 118 ok\r\n步驟 119 ok\r\n步驟 120 ok\r\n步驟 121 ok\r\n步驟 122 ok\r\n步驟 123 ok\r\n步驟 124 ok\r\n步驟 125 ok\r\n步驟 126 ok\r\n步驟 127 ok\r\n步驟 128 ok\r\n步驟 129 ok\r\n步驟 130 ok\r\n步驟 131 ok\r\n步驟 132 ok\r\n步驟 133 ok\r\n步驟 134 ok\r\n步驟 135 ok\r\n步驟 136 ok\r\n步驟 137 ok\r\n步驟 138 ok\r\n步驟 139 ok\r\n步驟 140 ok\r\n步驟 141 ok\r\n步驟 142 ok\r\n步驟 143 ok\r\n步驟 144 ok\r\n步驟 145 ok\r\n步驟 146 ok\r\n步驟 147 ok\r\n步驟 148 ok\r\n步驟 149 ok\r\n步驟 150 ok\r\n步驟 151 ok\r\n步驟 152 ok\r\n步驟 153 ok\r\n步驟 154 ok\r\n步驟 155 ok\r\n步驟 156 ok\r\n步驟 157 ok\r\n步驟 158 ok\r\n步驟 159 ok\r\n步驟 160 ok\r\n步驟 161 ok\r\n步驟 162 ok\r\n步驟 163 ok\r\n步驟 164 ok\r\n步驟 165 ok\r\n步驟 166 ok\r\n步驟 167 ok\r\n步驟 168 ok\r\n步驟 169 ok\r\n步驟 170 ok\r\n步驟 171 ok\r\n步驟 172 ok\r\n步驟 173 ok\r\n步驟 174 ok\r\n步驟 175 ok\r\n步驟 176 ok\r\n步驟 177 ok\r\n步驟 178 ok\r\n步驟 179 ok\r\n步驟 180 ok\r\n步驟 181 ok\r\n步驟 182 ok\r\n步驟 183 ok\r\n步驟 184 ok\r\n步驟 185 ok\r\n步驟 186 ok\r\n步驟 187 ok\r\n步驟 188 ok\r\n步驟 189 ok\r\n步驟 190 ok\r\n步驟 191 ok\r\n步驟 192 ok\r\n步驟 193 ok\r\n步驟 194 ok\r\n步驟 195 ok\r\n步驟 196 ok\r\n步驟 197 ok\r\n步驟 198 ok\r\n步驟 199 ok\r\n",
   "expected_output": "步驟 0 ok\r\n步驟 1 ok\r\n步驟 2 ok\r\n步驟 3 ok\r\n步驟 4 ok\r\n步驟 5 ok\r\n步驟 6 ok\r\n步驟 7 ok\r\n步驟 8 ok\r\n步驟 9 ok\r\n步驟 10 ok\r\n步驟 11 ok\r\n步驟 12 ok\r\n步驟 13 ok\r\n步驟 14 ok\r\n步驟 15 ok\r\n[omitted original lines; use readback for the full log]\n步驟 88 ok\r\n步驟 89 ok\r\n步驟 90 ok\r\n步驟 91 ok\r\n步驟 92 ok\r\n步驟 93 ok\r\n步驟 94 ok\r\n步驟 95 ok\r\n步驟 96 ok\r\n步驟 97 ok\r\n步驟 98 ok\r\n步驟 99 ok\r\nTraceback (most recent call last):\r\n  File \"x.py\", line 1\r\nValueError: 壞了\r\n步驟 100 ok\r\n步驟 101 ok\r\n步驟 102 ok\r\n步驟 103 ok\r\n步驟 104 ok\r\n步驟 105 ok\r\n步驟 106 ok\r\n步驟 107 ok\r\n步驟 108 ok\r\n[omitted original lines; use readback for the full log]\n步驟 189 ok\r\n步驟 190 ok\r\n步驟 191 ok\r\n步驟 192 ok\r\n步驟 193 ok\r\n步驟 194 ok\r\n步驟 195 ok\r\n步驟 196 ok\r\n步驟 197 ok\r\n步驟 198 ok\r\n步驟 199 ok\r\n",
   "expected_input_chars": 2165,
   "expected_reason": "ok"
  },
  {
   "name": "separators",
   "input": "a\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\n",
   "expected_output": "a\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\na\u000bb\f[omitted original lines; use readback for the full log]\nf g\na\u000bb\fc\u001cde f g\na\u000bb\fc\u001cde f g\n",
   "expected_input_chars": 560,
   "expected_reason": "ok"
  },
  {
   "name": "no-trailing-newline",
   "input": "line 0\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12\nline 13\nline 14\nline 15\nline 16\nline 17\nline 18\nline 19\nline 20\nline 21\nline 22\nline 23\nline 24\nline 25\nline 26\nline 27\nline 28\nline 29\nline 30\nline 31\nline 32\nline 33\nline 34\nline 35\nline 36\nline 37\nline 38\nline 39\nline 40\nline 41\nline 42\nline 43\nline 44\nline 45\nline 46\nline 47\nline 48\nline 49\nline 50\nline 51\nline 52\nline 53\nline 54\nline 55\nline 56\nline 57\nline 58\nline 59\nline 60\nline 61\nline 62\nline 63\nline 64\nline 65\nline 66\nline 67\nline 68\nline 69\nline 70\nline 71\nline 72\nline 73\nline 74\nline 75\nline 76\nline 77\nline 78\nline 79\nlast line without newline FAIL",
   "expected_output": "line 0\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12\nline 13\nline 14\nline 15\n[omitted original lines; use readback for the full log]\nline 72\nline 73\nline 74\nline 75\nline 76\nline 77\nline 78\nline 79\nlast line without newline FAIL",
   "expected_input_chars": 660,
   "expected_reason": "ok"
  },
  {
   "name": "all-important",
   "input": "error 0\nerror 1\nerror 2\nerror 3\nerror 4\nerror 5\nerror 6\nerror 7\nerror 8\nerror 9\nerror 10\nerror 11\nerror 12\nerror 13\nerror 14\nerror 15\nerror 16\nerror 17\nerror 18\nerror 19\nerror 20\nerror 21\nerror 22\nerror 23\nerror 24\nerror 25\nerror 26\nerror 27\nerror 28\nerror 29\nerror 30\nerror 31\nerror 32\nerror 33\nerror 34\nerror 35\nerror 36\nerror 37\nerror 38\nerror 39\nerror 40\nerror 41\nerror 42\nerror 43\nerror 44\nerror 45\nerror 46\nerror 47\nerror 48\nerror 49\n",
   "expected_output": "error 0\nerror 1\nerror 2\nerror 3\nerror 4\nerror 5\nerror 6\nerror 7\nerror 8\nerror 9\nerror 10\nerror 11\nerror 12\nerror 13\nerror 14\nerror 15\nerror 16\nerror 17\nerror 18\nerror 19\nerror 20\nerror 21\nerror 22\nerror 23\nerror 24\nerror 25\nerror 26\nerror 27\nerror 28\nerror 29\nerror 30\nerror 31\nerror 32\nerror 33\nerror 34\nerror 35\nerror 36\nerror 37\nerror 38\nerror 39\nerror 40\nerror 41\nerror 42\nerror 43\nerror 44\nerror 45\nerror 46\nerror 47\nerror 48\nerror 49\n",
   "expected_input_chars": 440,
   "expected_reason": "ok"
  },
  {
   "name": "cr-in-at-line",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nat foo\rbar:12\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nat foo\rbar:12\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\n[omitted original lines; use readback for the full log]\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 794,
   "expected_reason": "ok"
  },
  {
   "name": "unicode-digit",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nat foo:٣\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 789,
   "expected_reason": "ok"
  },
  {
   "name": "dotless-i",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nFAıL\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 785,
   "expected_reason": "ok"
  },
  {
   "name": "x1f-file",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n\u001f File x\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 789,
   "expected_reason": "ok"
  },
  {
   "name": "unicode-word-boundary",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nwarné x\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\nwarné x\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\n[omitted original lines; use readback for the full log]\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 788,
   "expected_reason": "ok"
  },
  {
   "name": "emoji-lines",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n😀 emoji line ERROR\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nfiller 30\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\n[omitted original lines; use readback for the full log]\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n😀 emoji line ERROR\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\n[omitted original lines; use readback for the full log]\nfiller 31\nfiller 32\nfiller 33\nfiller 34\nfiller 35\nfiller 36\nfiller 37\nfiller 38\nfiller 39\n",
   "expected_input_chars": 799,
   "expected_reason": "ok"
  },
  {
   "name": "repeated-warnings",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nWARNING: deprecated api call #5 at step 35\nWARNING: deprecated api call #6 at step 42\nWARNING: deprecated api call #7 at step 49\nWARNING: deprecated api call #8 at step 56\nWARNING: deprecated api call #9 at step 63\nWARNING: deprecated api call #10 at step 70\nWARNING: deprecated api call #11 at step 77\nWARNING: deprecated api call #12 at step 84\nWARNING: deprecated api call #13 at step 91\nWARNING: deprecated api call #14 at step 98\nWARNING: deprecated api call #15 at step 105\nWARNING: deprecated api call #16 at step 112\nWARNING: deprecated api call #17 at step 119\nWARNING: deprecated api call #18 at step 126\nWARNING: deprecated api call #19 at step 133\nWARNING: deprecated api call #20 at step 140\nWARNING: deprecated api call #21 at step 147\nWARNING: deprecated api call #22 at step 154\nWARNING: deprecated api call #23 at step 161\nWARNING: deprecated api call #24 at step 168\nWARNING: deprecated api call #25 at step 175\nWARNING: deprecated api call #26 at step 182\nWARNING: deprecated api call #27 at step 189\nWARNING: deprecated api call #28 at step 196\nWARNING: deprecated api call #29 at step 203\nWARNING: deprecated api call #30 at step 210\nWARNING: deprecated api call #31 at step 217\nWARNING: deprecated api call #32 at step 224\nWARNING: deprecated api call #33 at step 231\nWARNING: deprecated api call #34 at step 238\nWARNING: deprecated api call #35 at step 245\nWARNING: deprecated api call #36 at step 252\nWARNING: deprecated api call #37 at step 259\nWARNING: deprecated api call #38 at step 266\nWARNING: deprecated api call #39 at step 273\nWARNING: deprecated api call #40 at step 280\nWARNING: deprecated api call #41 at step 287\nWARNING: deprecated api call #42 at step 294\nWARNING: deprecated api call #43 at step 301\nWARNING: deprecated api call #44 at step 308\nWARNING: deprecated api call #45 at step 315\nWARNING: deprecated api call #46 at step 322\nWARNING: deprecated api call #47 at step 329\nWARNING: deprecated api call #48 at step 336\nWARNING: deprecated api call #49 at step 343\nWARNING: deprecated api call #50 at step 350\nWARNING: deprecated api call #51 at step 357\nWARNING: deprecated api call #52 at step 364\nWARNING: deprecated api call #53 at step 371\nWARNING: deprecated api call #54 at step 378\nWARNING: deprecated api call #55 at step 385\nWARNING: deprecated api call #56 at step 392\nWARNING: deprecated api call #57 at step 399\nWARNING: deprecated api call #58 at step 406\nWARNING: deprecated api call #59 at step 413\nWARNING: deprecated api call #60 at step 420\nWARNING: deprecated api call #61 at step 427\nWARNING: deprecated api call #62 at step 434\nWARNING: deprecated api call #63 at step 441\nWARNING: deprecated api call #64 at step 448\nWARNING: deprecated api call #65 at step 455\nWARNING: deprecated api call #66 at step 462\nWARNING: deprecated api call #67 at step 469\nWARNING: deprecated api call #68 at step 476\nWARNING: deprecated api call #69 at step 483\nWARNING: deprecated api call #70 at step 490\nWARNING: deprecated api call #71 at step 497\nWARNING: deprecated api call #72 at step 504\nWARNING: deprecated api call #73 at step 511\nWARNING: deprecated api call #74 at step 518\nWARNING: deprecated api call #75 at step 525\nWARNING: deprecated api call #76 at step 532\nWARNING: deprecated api call #77 at step 539\nWARNING: deprecated api call #78 at step 546\nWARNING: deprecated api call #79 at step 553\nWARNING: deprecated api call #80 at step 560\nWARNING: deprecated api call #81 at step 567\nWARNING: deprecated api call #82 at step 574\nWARNING: deprecated api call #83 at step 581\nWARNING: deprecated api call #84 at step 588\nWARNING: deprecated api call #85 at step 595\nWARNING: deprecated api call #86 at step 602\nWARNING: deprecated api call #87 at step 609\nWARNING: deprecated api call #88 at step 616\nWARNING: deprecated api call #89 at step 623\nWARNING: deprecated api call #90 at step 630\nWARNING: deprecated api call #91 at step 637\nWARNING: deprecated api call #92 at step 644\nWARNING: deprecated api call #93 at step 651\nWARNING: deprecated api call #94 at step 658\nWARNING: deprecated api call #95 at step 665\nWARNING: deprecated api call #96 at step 672\nWARNING: deprecated api call #97 at step 679\nWARNING: deprecated api call #98 at step 686\nWARNING: deprecated api call #99 at step 693\nWARNING: deprecated api call #100 at step 700\nWARNING: deprecated api call #101 at step 707\nWARNING: deprecated api call #102 at step 714\nWARNING: deprecated api call #103 at step 721\nWARNING: deprecated api call #104 at step 728\nWARNING: deprecated api call #105 at step 735\nWARNING: deprecated api call #106 at step 742\nWARNING: deprecated api call #107 at step 749\nWARNING: deprecated api call #108 at step 756\nWARNING: deprecated api call #109 at step 763\nWARNING: deprecated api call #110 at step 770\nWARNING: deprecated api call #111 at step 777\nWARNING: deprecated api call #112 at step 784\nWARNING: deprecated api call #113 at step 791\nWARNING: deprecated api call #114 at step 798\nWARNING: deprecated api call #115 at step 805\nWARNING: deprecated api call #116 at step 812\nWARNING: deprecated api call #117 at step 819\nWARNING: deprecated api call #118 at step 826\nWARNING: deprecated api call #119 at step 833\nWARNING: deprecated api call #120 at step 840\nWARNING: deprecated api call #121 at step 847\nWARNING: deprecated api call #122 at step 854\nWARNING: deprecated api call #123 at step 861\nWARNING: deprecated api call #124 at step 868\nWARNING: deprecated api call #125 at step 875\nWARNING: deprecated api call #126 at step 882\nWARNING: deprecated api call #127 at step 889\nWARNING: deprecated api call #128 at step 896\nWARNING: deprecated api call #129 at step 903\nWARNING: deprecated api call #130 at step 910\nWARNING: deprecated api call #131 at step 917\nWARNING: deprecated api call #132 at step 924\nWARNING: deprecated api call #133 at step 931\nWARNING: deprecated api call #134 at step 938\nWARNING: deprecated api call #135 at step 945\nWARNING: deprecated api call #136 at step 952\nWARNING: deprecated api call #137 at step 959\nWARNING: deprecated api call #138 at step 966\nWARNING: deprecated api call #139 at step 973\nWARNING: deprecated api call #140 at step 980\nWARNING: deprecated api call #141 at step 987\nWARNING: deprecated api call #142 at step 994\nWARNING: deprecated api call #143 at step 1001\nWARNING: deprecated api call #144 at step 1008\nWARNING: deprecated api call #145 at step 1015\nWARNING: deprecated api call #146 at step 1022\nWARNING: deprecated api call #147 at step 1029\nWARNING: deprecated api call #148 at step 1036\nWARNING: deprecated api call #149 at step 1043\nWARNING: deprecated api call #150 at step 1050\nWARNING: deprecated api call #151 at step 1057\nWARNING: deprecated api call #152 at step 1064\nWARNING: deprecated api call #153 at step 1071\nWARNING: deprecated api call #154 at step 1078\nWARNING: deprecated api call #155 at step 1085\nWARNING: deprecated api call #156 at step 1092\nWARNING: deprecated api call #157 at step 1099\nWARNING: deprecated api call #158 at step 1106\nWARNING: deprecated api call #159 at step 1113\nWARNING: deprecated api call #160 at step 1120\nWARNING: deprecated api call #161 at step 1127\nWARNING: deprecated api call #162 at step 1134\nWARNING: deprecated api call #163 at step 1141\nWARNING: deprecated api call #164 at step 1148\nWARNING: deprecated api call #165 at step 1155\nWARNING: deprecated api call #166 at step 1162\nWARNING: deprecated api call #167 at step 1169\nWARNING: deprecated api call #168 at step 1176\nWARNING: deprecated api call #169 at step 1183\nWARNING: deprecated api call #170 at step 1190\nWARNING: deprecated api call #171 at step 1197\nWARNING: deprecated api call #172 at step 1204\nWARNING: deprecated api call #173 at step 1211\nWARNING: deprecated api call #174 at step 1218\nWARNING: deprecated api call #175 at step 1225\nWARNING: deprecated api call #176 at step 1232\nWARNING: deprecated api call #177 at step 1239\nWARNING: deprecated api call #178 at step 1246\nWARNING: deprecated api call #179 at step 1253\nWARNING: deprecated api call #180 at step 1260\nWARNING: deprecated api call #181 at step 1267\nWARNING: deprecated api call #182 at step 1274\nWARNING: deprecated api call #183 at step 1281\nWARNING: deprecated api call #184 at step 1288\nWARNING: deprecated api call #185 at step 1295\nWARNING: deprecated api call #186 at step 1302\nWARNING: deprecated api call #187 at step 1309\nWARNING: deprecated api call #188 at step 1316\nWARNING: deprecated api call #189 at step 1323\nWARNING: deprecated api call #190 at step 1330\nWARNING: deprecated api call #191 at step 1337\nWARNING: deprecated api call #192 at step 1344\nWARNING: deprecated api call #193 at step 1351\nWARNING: deprecated api call #194 at step 1358\nWARNING: deprecated api call #195 at step 1365\nWARNING: deprecated api call #196 at step 1372\nWARNING: deprecated api call #197 at step 1379\nWARNING: deprecated api call #198 at step 1386\nWARNING: deprecated api call #199 at step 1393\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\n[197 similar lines omitted (original lines 33-229)]\nWARNING: deprecated api call #199 at step 1393\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_input_chars": 9710,
   "expected_reason": "ok"
  },
  {
   "name": "warnings-below-threshold",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\n[omitted original lines; use readback for the full log]\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_input_chars": 793,
   "expected_reason": "ok"
  },
  {
   "name": "warnings-with-error-never-collapsed",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: warn error code call #0 at step 0\nWARNING: warn error code call #1 at step 7\nWARNING: warn error code call #2 at step 14\nWARNING: warn error code call #3 at step 21\nWARNING: warn error code call #4 at step 28\nWARNING: warn error code call #5 at step 35\nWARNING: warn error code call #6 at step 42\nWARNING: warn error code call #7 at step 49\nWARNING: warn error code call #8 at step 56\nWARNING: warn error code call #9 at step 63\nWARNING: warn error code call #10 at step 70\nWARNING: warn error code call #11 at step 77\nWARNING: warn error code call #12 at step 84\nWARNING: warn error code call #13 at step 91\nWARNING: warn error code call #14 at step 98\nWARNING: warn error code call #15 at step 105\nWARNING: warn error code call #16 at step 112\nWARNING: warn error code call #17 at step 119\nWARNING: warn error code call #18 at step 126\nWARNING: warn error code call #19 at step 133\nWARNING: warn error code call #20 at step 140\nWARNING: warn error code call #21 at step 147\nWARNING: warn error code call #22 at step 154\nWARNING: warn error code call #23 at step 161\nWARNING: warn error code call #24 at step 168\nWARNING: warn error code call #25 at step 175\nWARNING: warn error code call #26 at step 182\nWARNING: warn error code call #27 at step 189\nWARNING: warn error code call #28 at step 196\nWARNING: warn error code call #29 at step 203\nWARNING: warn error code call #30 at step 210\nWARNING: warn error code call #31 at step 217\nWARNING: warn error code call #32 at step 224\nWARNING: warn error code call #33 at step 231\nWARNING: warn error code call #34 at step 238\nWARNING: warn error code call #35 at step 245\nWARNING: warn error code call #36 at step 252\nWARNING: warn error code call #37 at step 259\nWARNING: warn error code call #38 at step 266\nWARNING: warn error code call #39 at step 273\nWARNING: warn error code call #40 at step 280\nWARNING: warn error code call #41 at step 287\nWARNING: warn error code call #42 at step 294\nWARNING: warn error code call #43 at step 301\nWARNING: warn error code call #44 at step 308\nWARNING: warn error code call #45 at step 315\nWARNING: warn error code call #46 at step 322\nWARNING: warn error code call #47 at step 329\nWARNING: warn error code call #48 at step 336\nWARNING: warn error code call #49 at step 343\nWARNING: warn error code call #50 at step 350\nWARNING: warn error code call #51 at step 357\nWARNING: warn error code call #52 at step 364\nWARNING: warn error code call #53 at step 371\nWARNING: warn error code call #54 at step 378\nWARNING: warn error code call #55 at step 385\nWARNING: warn error code call #56 at step 392\nWARNING: warn error code call #57 at step 399\nWARNING: warn error code call #58 at step 406\nWARNING: warn error code call #59 at step 413\nWARNING: warn error code call #60 at step 420\nWARNING: warn error code call #61 at step 427\nWARNING: warn error code call #62 at step 434\nWARNING: warn error code call #63 at step 441\nWARNING: warn error code call #64 at step 448\nWARNING: warn error code call #65 at step 455\nWARNING: warn error code call #66 at step 462\nWARNING: warn error code call #67 at step 469\nWARNING: warn error code call #68 at step 476\nWARNING: warn error code call #69 at step 483\nWARNING: warn error code call #70 at step 490\nWARNING: warn error code call #71 at step 497\nWARNING: warn error code call #72 at step 504\nWARNING: warn error code call #73 at step 511\nWARNING: warn error code call #74 at step 518\nWARNING: warn error code call #75 at step 525\nWARNING: warn error code call #76 at step 532\nWARNING: warn error code call #77 at step 539\nWARNING: warn error code call #78 at step 546\nWARNING: warn error code call #79 at step 553\nWARNING: warn error code call #80 at step 560\nWARNING: warn error code call #81 at step 567\nWARNING: warn error code call #82 at step 574\nWARNING: warn error code call #83 at step 581\nWARNING: warn error code call #84 at step 588\nWARNING: warn error code call #85 at step 595\nWARNING: warn error code call #86 at step 602\nWARNING: warn error code call #87 at step 609\nWARNING: warn error code call #88 at step 616\nWARNING: warn error code call #89 at step 623\nWARNING: warn error code call #90 at step 630\nWARNING: warn error code call #91 at step 637\nWARNING: warn error code call #92 at step 644\nWARNING: warn error code call #93 at step 651\nWARNING: warn error code call #94 at step 658\nWARNING: warn error code call #95 at step 665\nWARNING: warn error code call #96 at step 672\nWARNING: warn error code call #97 at step 679\nWARNING: warn error code call #98 at step 686\nWARNING: warn error code call #99 at step 693\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: warn error code call #0 at step 0\nWARNING: warn error code call #1 at step 7\nWARNING: warn error code call #2 at step 14\nWARNING: warn error code call #3 at step 21\nWARNING: warn error code call #4 at step 28\nWARNING: warn error code call #5 at step 35\nWARNING: warn error code call #6 at step 42\nWARNING: warn error code call #7 at step 49\nWARNING: warn error code call #8 at step 56\nWARNING: warn error code call #9 at step 63\nWARNING: warn error code call #10 at step 70\nWARNING: warn error code call #11 at step 77\nWARNING: warn error code call #12 at step 84\nWARNING: warn error code call #13 at step 91\nWARNING: warn error code call #14 at step 98\nWARNING: warn error code call #15 at step 105\nWARNING: warn error code call #16 at step 112\nWARNING: warn error code call #17 at step 119\nWARNING: warn error code call #18 at step 126\nWARNING: warn error code call #19 at step 133\nWARNING: warn error code call #20 at step 140\nWARNING: warn error code call #21 at step 147\nWARNING: warn error code call #22 at step 154\nWARNING: warn error code call #23 at step 161\nWARNING: warn error code call #24 at step 168\nWARNING: warn error code call #25 at step 175\nWARNING: warn error code call #26 at step 182\nWARNING: warn error code call #27 at step 189\nWARNING: warn error code call #28 at step 196\nWARNING: warn error code call #29 at step 203\nWARNING: warn error code call #30 at step 210\nWARNING: warn error code call #31 at step 217\nWARNING: warn error code call #32 at step 224\nWARNING: warn error code call #33 at step 231\nWARNING: warn error code call #34 at step 238\nWARNING: warn error code call #35 at step 245\nWARNING: warn error code call #36 at step 252\nWARNING: warn error code call #37 at step 259\nWARNING: warn error code call #38 at step 266\nWARNING: warn error code call #39 at step 273\nWARNING: warn error code call #40 at step 280\nWARNING: warn error code call #41 at step 287\nWARNING: warn error code call #42 at step 294\nWARNING: warn error code call #43 at step 301\nWARNING: warn error code call #44 at step 308\nWARNING: warn error code call #45 at step 315\nWARNING: warn error code call #46 at step 322\nWARNING: warn error code call #47 at step 329\nWARNING: warn error code call #48 at step 336\nWARNING: warn error code call #49 at step 343\nWARNING: warn error code call #50 at step 350\nWARNING: warn error code call #51 at step 357\nWARNING: warn error code call #52 at step 364\nWARNING: warn error code call #53 at step 371\nWARNING: warn error code call #54 at step 378\nWARNING: warn error code call #55 at step 385\nWARNING: warn error code call #56 at step 392\nWARNING: warn error code call #57 at step 399\nWARNING: warn error code call #58 at step 406\nWARNING: warn error code call #59 at step 413\nWARNING: warn error code call #60 at step 420\nWARNING: warn error code call #61 at step 427\nWARNING: warn error code call #62 at step 434\nWARNING: warn error code call #63 at step 441\nWARNING: warn error code call #64 at step 448\nWARNING: warn error code call #65 at step 455\nWARNING: warn error code call #66 at step 462\nWARNING: warn error code call #67 at step 469\nWARNING: warn error code call #68 at step 476\nWARNING: warn error code call #69 at step 483\nWARNING: warn error code call #70 at step 490\nWARNING: warn error code call #71 at step 497\nWARNING: warn error code call #72 at step 504\nWARNING: warn error code call #73 at step 511\nWARNING: warn error code call #74 at step 518\nWARNING: warn error code call #75 at step 525\nWARNING: warn error code call #76 at step 532\nWARNING: warn error code call #77 at step 539\nWARNING: warn error code call #78 at step 546\nWARNING: warn error code call #79 at step 553\nWARNING: warn error code call #80 at step 560\nWARNING: warn error code call #81 at step 567\nWARNING: warn error code call #82 at step 574\nWARNING: warn error code call #83 at step 581\nWARNING: warn error code call #84 at step 588\nWARNING: warn error code call #85 at step 595\nWARNING: warn error code call #86 at step 602\nWARNING: warn error code call #87 at step 609\nWARNING: warn error code call #88 at step 616\nWARNING: warn error code call #89 at step 623\nWARNING: warn error code call #90 at step 630\nWARNING: warn error code call #91 at step 637\nWARNING: warn error code call #92 at step 644\nWARNING: warn error code call #93 at step 651\nWARNING: warn error code call #94 at step 658\nWARNING: warn error code call #95 at step 665\nWARNING: warn error code call #96 at step 672\nWARNING: warn error code call #97 at step 679\nWARNING: warn error code call #98 at step 686\nWARNING: warn error code call #99 at step 693\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_input_chars": 5153,
   "expected_reason": "ok"
  },
  {
   "name": "warning-runs-broken-by-error",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nWARNING: deprecated api call #5 at step 35\nWARNING: deprecated api call #6 at step 42\nWARNING: deprecated api call #7 at step 49\nWARNING: deprecated api call #8 at step 56\nWARNING: deprecated api call #9 at step 63\nERROR boom\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nWARNING: deprecated api call #5 at step 35\nWARNING: deprecated api call #6 at step 42\nWARNING: deprecated api call #7 at step 49\nWARNING: deprecated api call #8 at step 56\nWARNING: deprecated api call #9 at step 63\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\n[7 similar lines omitted (original lines 33-39)]\nWARNING: deprecated api call #9 at step 63\nERROR boom\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\n[7 similar lines omitted (original lines 44-50)]\nWARNING: deprecated api call #9 at step 63\nfiller 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\n[omitted original lines; use readback for the full log]\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\n",
   "expected_input_chars": 1447,
   "expected_reason": "ok"
  },
  {
   "name": "warning-run-no-trailing-newline",
   "input": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\nWARNING: deprecated api call #2 at step 14\nWARNING: deprecated api call #3 at step 21\nWARNING: deprecated api call #4 at step 28\nWARNING: deprecated api call #5 at step 35\nWARNING: deprecated api call #6 at step 42\nWARNING: deprecated api call #7 at step 49\nWARNING: deprecated api call #8 at step 56",
   "expected_output": "filler 0\nfiller 1\nfiller 2\nfiller 3\nfiller 4\nfiller 5\nfiller 6\nfiller 7\nfiller 8\nfiller 9\nfiller 10\nfiller 11\nfiller 12\nfiller 13\nfiller 14\nfiller 15\nfiller 16\nfiller 17\nfiller 18\nfiller 19\nfiller 20\nfiller 21\nfiller 22\nfiller 23\nfiller 24\nfiller 25\nfiller 26\nfiller 27\nfiller 28\nfiller 29\nWARNING: deprecated api call #0 at step 0\nWARNING: deprecated api call #1 at step 7\n[5 similar lines omitted (original lines 33-37)]\nWARNING: deprecated api call #7 at step 49\nWARNING: deprecated api call #8 at step 56",
   "expected_input_chars": 674,
   "expected_reason": "ok"
  },
  {
   "name": "emoji-bulk",
   "input": "😀 line 0\n😀 line 1\n😀 line 2\n😀 line 3\n😀 line 4\n😀 line 5\n😀 line 6\n😀 line 7\n😀 line 8\n😀 line 9\n😀 line 10\n😀 line 11\n😀 line 12\n😀 line 13\n😀 line 14\n😀 line 15\n😀 line 16\n😀 line 17\n😀 line 18\n😀 line 19\n😀 line 20\n😀 line 21\n😀 line 22\n😀 line 23\n😀 line 24\n😀 line 25\n😀 line 26\n😀 line 27\n😀 line 28\n😀 line 29\n😀 line 30\n😀 line 31\n😀 line 32\n😀 line 33\n😀 line 34\n😀 line 35\n😀 line 36\n😀 line 37\n😀 line 38\n😀 line 39\n😀 line 40\n😀 line 41\n😀 line 42\n😀 line 43\n😀 line 44\n😀 line 45\n😀 line 46\n😀 line 47\n😀 line 48\n😀 line 49\n😀 line 50\n😀 line 51\n😀 line 52\n😀 line 53\n😀 line 54\n😀 line 55\n😀 line 56\n😀 line 57\n😀 line 58\n😀 line 59\n😀 line 60\n😀 line 61\n😀 line 62\n😀 line 63\n😀 line 64\n😀 line 65\n😀 line 66\n😀 line 67\n😀 line 68\n😀 line 69\n😀 line 70\n😀 line 71\n😀 line 72\n😀 line 73\n😀 line 74\n😀 line 75\n😀 line 76\n😀 line 77\n😀 line 78\n😀 line 79\n😀 line 80\n😀 line 81\n😀 line 82\n😀 line 83\n😀 line 84\n😀 line 85\n😀 line 86\n😀 line 87\n😀 line 88\n😀 line 89\n😀 line 90\n😀 line 91\n😀 line 92\n😀 line 93\n😀 line 94\n😀 line 95\n😀 line 96\n😀 line 97\n😀 line 98\n😀 line 99\n😀 line 100\n😀 line 101\n😀 line 102\n😀 line 103\n😀 line 104\n😀 line 105\n😀 line 106\n😀 line 107\n😀 line 108\n😀 line 109\n😀 line 110\n😀 line 111\n😀 line 112\n😀 line 113\n😀 line 114\n😀 line 115\n😀 line 116\n😀 line 117\n😀 line 118\n😀 line 119\n",
   "expected_output": "😀 line 0\n😀 line 1\n😀 line 2\n😀 line 3\n😀 line 4\n😀 line 5\n😀 line 6\n😀 line 7\n😀 line 8\n😀 line 9\n😀 line 10\n😀 line 11\n😀 line 12\n😀 line 13\n😀 line 14\n😀 line 15\n[omitted original lines; use readback for the full log]\n😀 line 104\n😀 line 105\n😀 line 106\n😀 line 107\n😀 line 108\n😀 line 109\n😀 line 110\n😀 line 111\n😀 line 112\n😀 line 113\n😀 line 114\n😀 line 115\n😀 line 116\n😀 line 117\n😀 line 118\n😀 line 119\n",
   "expected_input_chars": 1210,
   "expected_reason": "ok"
  }
 ]
}
