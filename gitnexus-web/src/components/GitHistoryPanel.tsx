/**
 * Git History Panel
 *
 * Displays paginated commit history with filter controls.
 * Clicking a commit expands it to show changed files.
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, GitCommit, GitBranch, ChevronDown, ChevronRight, Clock, User } from '@/lib/lucide-icons';
import { useAppState } from '../hooks/useAppState';
import { fetchGitLog, fetchGitShow } from '../services/backend-client';
import type { GitCommitInfo, GitLogSummary, GitShowResult } from '../services/backend-client';

export const GitHistoryPanel = () => {
  const { projectName } = useAppState();

  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [summary, setSummary] = useState<GitLogSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [sinceFilter, setSinceFilter] = useState('');
  const [untilFilter, setUntilFilter] = useState('');

  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<GitShowResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const PAGE_SIZE = 30;

  const load = useCallback(
    async (newOffset: number, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGitLog(projectName ?? undefined, {
          limit: PAGE_SIZE,
          offset: newOffset,
          search: searchQuery || undefined,
          author: authorFilter || undefined,
          since: sinceFilter || undefined,
          until: untilFilter || undefined,
        });
        setSummary(result.summary);
        setTotal(result.total);
        setHasMore(result.has_more);
        setOffset(newOffset);
        setCommits(reset ? result.commits : (prev) => [...prev, ...result.commits]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load git history');
      } finally {
        setLoading(false);
      }
    },
    [projectName, searchQuery, authorFilter, sinceFilter, untilFilter],
  );

  useEffect(() => {
    load(0, true);
    setExpandedCommit(null);
    setCommitDetail(null);
  }, [load]);

  const handleToggleCommit = useCallback(
    async (hash: string) => {
      if (expandedCommit === hash) {
        setExpandedCommit(null);
        setCommitDetail(null);
        return;
      }
      setExpandedCommit(hash);
      setCommitDetail(null);
      setLoadingDetail(true);
      try {
        const detail = await fetchGitShow(hash, projectName ?? undefined);
        setCommitDetail(detail);
      } catch {
        // silently fail — commit detail is optional
      } finally {
        setLoadingDetail(false);
      }
    },
    [expandedCommit, projectName],
  );

  const handleSearch = useCallback(() => {
    load(0, true);
    setExpandedCommit(null);
    setCommitDetail(null);
  }, [load]);

  const handleLoadMore = useCallback(() => {
    load(offset + PAGE_SIZE, false);
  }, [load, offset]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface">
          <GitCommit className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-sm text-rose-400">{error}</p>
        <button
          onClick={() => load(0, true)}
          className="mt-3 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-3 border-b border-border-subtle bg-elevated/30 px-4 py-2 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            {summary.currentBranch}
          </span>
          <span className="text-border-subtle">·</span>
          <span>{summary.totalCommits} commits</span>
          {summary.contributors.length > 0 && (
            <>
              <span className="text-border-subtle">·</span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {summary.contributors[0].name}
                {summary.contributors.length > 1 && ` +${summary.contributors.length - 1}`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-border-subtle p-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-elevated px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search className="h-4 w-4 flex-shrink-0 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search commit messages..."
            className="flex-1 border-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Author..."
            className="flex-1 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
          <input
            type="text"
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Since (YYYY-MM-DD)"
            className="flex-1 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
        </div>
      </div>

      {/* Commit list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {loading && commits.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            Loading history...
          </div>
        ) : commits.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center">
            <GitCommit className="mb-2 h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">No commits found</p>
          </div>
        ) : (
          <div>
            {commits.map((commit) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                isExpanded={expandedCommit === commit.hash}
                detail={expandedCommit === commit.hash ? commitDetail : null}
                loadingDetail={expandedCommit === commit.hash && loadingDetail}
                onToggle={() => handleToggleCommit(commit.hash)}
              />
            ))}

            {hasMore && (
              <div className="px-4 py-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="w-full rounded-lg border border-border-subtle bg-elevated/40 py-2 text-xs text-text-secondary transition-colors hover:bg-elevated/80 hover:text-text-primary disabled:opacity-50"
                >
                  {loading ? 'Loading...' : `Load more (${total - offset - commits.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface CommitRowProps {
  commit: GitCommitInfo;
  isExpanded: boolean;
  detail: GitShowResult | null;
  loadingDetail: boolean;
  onToggle: () => void;
}

const CommitRow = ({ commit, isExpanded, detail, loadingDetail, onToggle }: CommitRowProps) => {
  const shortHash = commit.shortHash ?? commit.hash.slice(0, 7);
  const dateStr = commit.date ? commit.date.slice(0, 10) : '';

  return (
    <div className={`border-b border-border-subtle transition-colors ${isExpanded ? 'bg-surface/60' : 'hover:bg-hover'}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex-shrink-0 text-text-muted">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">{commit.subject}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            <code className="rounded bg-elevated px-1 py-0.5 font-mono text-accent">
              {shortHash}
            </code>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border-subtle/50 px-4 pb-3 pt-2">
          {loadingDetail ? (
            <p className="text-xs text-text-muted">Loading files...</p>
          ) : detail ? (
            <div>
              <div className="mb-2 flex items-center gap-3 text-xs text-text-muted">
                <span className="text-emerald-400">+{detail.stats.insertions}</span>
                <span className="text-rose-400">−{detail.stats.deletions}</span>
                <span>{detail.stats.filesChanged} file{detail.stats.filesChanged !== 1 ? 's' : ''} changed</span>
              </div>
              <div className="space-y-1">
                {detail.files.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-elevated"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        file.status === 'added'
                          ? 'bg-emerald-400'
                          : file.status === 'deleted'
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                      {file.path}
                    </span>
                    {(file.insertions > 0 || file.deletions > 0) && (
                      <span className="flex-shrink-0 text-text-muted">
                        <span className="text-emerald-400">+{file.insertions}</span>
                        {' '}
                        <span className="text-rose-400">−{file.deletions}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
