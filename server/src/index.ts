import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/github/issue", async (req, res) => {
  const issueUrl = req.query.url;

  if (typeof issueUrl !== "string") {
    res.status(400).json({ error: "Provide a GitHub issue URL." });
    return;
  }

  let owner: string;
  let repo: string;
  let issueNumber: string;

  try {
    const url = new URL(issueUrl);
    const parts = url.pathname.split("/").filter(Boolean);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      parts.length !== 4 ||
      parts[2] !== "issues" ||
      !/^\d+$/.test(parts[3]) ||
      Number(parts[3]) < 1
    ) {
      throw new Error("Invalid issue URL");
    }

    [owner, repo] = parts;
    issueNumber = parts[3];
  } catch {
    res.status(400).json({
      error: "Use a URL like https://github.com/owner/repo/issues/123",
    });
    return;
  }

  const baseUrl =
    `https://api.github.com/repos/${owner}/${repo}`;

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const [issueResponse, repoResponse, commentsResponse] =
      await Promise.all([
        fetch(`${baseUrl}/issues/${issueNumber}`, { headers }),
        fetch(baseUrl, { headers }),
        fetch(`${baseUrl}/issues/${issueNumber}/comments`, { headers }),
      ]);

    if (
      !issueResponse.ok ||
      !repoResponse.ok ||
      !commentsResponse.ok
    ) {
      const status = [
        issueResponse.status,
        repoResponse.status,
        commentsResponse.status,
      ].find((status) => status !== 200);

      res.status(status === 404 ? 404 : 502).json({
        error:
          status === 404
            ? "Issue or repository not found."
            : `GitHub API request failed (${status}).`,
      });
      return;
    }

    const [issue, repository, comments] = await Promise.all([
      issueResponse.json(),
      repoResponse.json(),
      commentsResponse.json(),
    ]);

    res.json({ issue, repository, comments });
  } catch {
    res.status(502).json({
      error: "Could not connect to GitHub.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
