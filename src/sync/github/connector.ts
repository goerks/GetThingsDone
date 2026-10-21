import { FIELD_NAMES, statusName, type Catalog, type ExternalItem, type ExternalRelease, type ItemPatch, type NewItem } from '../../domain/sync';
import type { Epic, ExternalLink, StatusValue } from '../../domain/types';
import type { Made, Needs, TidyResult, TrackerConnector, WriteContext, WriteResult } from '../connector';
import type { GithubApi } from './api';
import { epicLabelText, epicOfLabel, inRepo, issueNumberOf, parseRepo, repoText, statusLabelText, statusOfLabel, toItem, toNewIssue, toPatch, type ExternalMilestone, type GithubPatch, type RepoRef } from './format';

/** The colours of labels made for epics and statuses, as hex without the hash. */
const EPIC_HEX: Record<Epic['colorKey'], string> = { blue: '3b82f6', amber: 'f59e0b', teal: '14b8a6', violet: '8b5cf6', rose: 'f43f5e', green: '22c55e', cyan: '06b6d4', slate: '64748b' };
const STATUS_HEX: Record<StatusValue['category'], string> = { not_started: '64748b', in_progress: '3b82f6', done: '22c55e' };

const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** What the connector keeps in the catalog: the labels of the repository and its milestones as GitHub has them (with numbers). */
interface GithubCatalog {
  labels: string[];
  milestones: ExternalMilestone[];
}

const releaseOf = (milestone: ExternalMilestone): ExternalRelease => ({ id: String(milestone.number), title: milestone.title, description: milestone.description, dueOn: milestone.dueOn, state: milestone.state });

const extraOf = (catalog: Catalog): GithubCatalog => catalog.extra as GithubCatalog;

/**
 * The connector of GitHub Issues (#30, ADR 0005, ADR 0006): it turns issues into items and what the sync publishes into
 * GitHub's calls. Releases are milestones, epics are the labels "epic: <name>", the columns between the first and done are
 * the labels "status: <name>". The labels and milestones the sync needs are made before it changes an issue, and the ones
 * it made are deleted again when nothing needs them any more (AC16 of #30).
 */
export function createGithubConnector(api: GithubApi): TrackerConnector<RepoRef> {
  /** Makes the epic and status labels a list of labels holds that GitHub does not have yet, in the colour of the epic or the column. */
  async function makeLabels(repo: RepoRef, token: string, labels: readonly string[], context: WriteContext): Promise<void> {
    const github = extraOf(context.catalog);
    for (const label of labels) {
      if (github.labels.some((item) => same(item, label))) continue;
      const epic = epicOfLabel(label);
      const status = statusOfLabel(label);
      if (epic === null && status === null) continue;
      const color =
        epic !== null
          ? (EPIC_HEX[context.epics.find((item) => same(item.name, epic))?.colorKey ?? 'slate'] ?? EPIC_HEX.slate)
          : STATUS_HEX[context.statuses.find((item) => same(statusName(item), status))?.category ?? 'in_progress'];
      await api.createLabel(repo, token, { name: label, color });
      github.labels.push(label);
      context.made.labels.push(label);
    }
  }

  return {
    kind: 'github',
    capabilities: { fields: FIELD_NAMES, create: true, tidy: true },
    target: (connection) => parseRepo(connection.repo ?? ''),
    normalize(connection): Record<string, string> | null {
      const text = (connection.repo ?? '').trim();
      if (text === '') return {};
      const repo = parseRepo(text);
      return repo ? { repo: repoText(repo) } : null;
    },
    async open(repo, token) {
      const issues = await api.openIssues(repo, token);
      return issues.filter((issue) => inRepo(issue.url, repo)).map(toItem);
    },
    async item(repo, token, id) {
      const issue = await api.issue(repo, token, Number(id));
      return issue && inRepo(issue.url, repo) ? toItem(issue) : null;
    },
    idOf(repo, link: ExternalLink) {
      const number = inRepo(link.url, repo) ? issueNumberOf(link.url) : null;
      return number === null ? null : String(number);
    },
    async catalog(repo, token) {
      const milestones = await api.listMilestones(repo, token);
      const labels = await api.listLabels(repo, token);
      const extra: GithubCatalog = { labels: [...labels], milestones: [...milestones] };
      return { releases: milestones.map(releaseOf), extra };
    },
    lacks(catalog, kind, name) {
      const label = kind === 'epic' ? epicLabelText(name) : statusLabelText(name);
      return extraOf(catalog).labels.some((item) => same(item, label)) ? null : label;
    },
    async update(repo, token, item: ExternalItem, patch: ItemPatch, context): Promise<WriteResult> {
      const github = extraOf(context.catalog);
      // The milestone of a release is made before the issue gets it.
      let milestone: number | null | undefined;
      if (patch.release !== undefined) {
        const title = patch.release;
        if (title === null) {
          milestone = null;
        } else {
          let found = github.milestones.find((entry) => same(entry.title, title));
          const release = context.releases.find((entry) => same(entry.title, title));
          if (!found && release) {
            found = await api.createMilestone(repo, token, { title: release.title, description: release.description, dueOn: release.endDate });
            github.milestones.push(found);
            context.catalog.releases.push(releaseOf(found));
            context.made.milestones.push(found.title);
          }
          milestone = found?.number ?? null;
        }
      }
      const out: GithubPatch = toPatch(item, patch, milestone);
      // The labels of its epic and its column are made before the issue gets them.
      await makeLabels(repo, token, out.labels ?? [], context);
      const result = await api.updateIssue(repo, token, Number(item.id), out);
      return { item: toItem(result.issue), skippedLabels: result.skippedLabels };
    },
    async create(repo, token, item: NewItem, context): Promise<WriteResult> {
      const issue = toNewIssue(item);
      await makeLabels(repo, token, issue.labels, context);
      const result = await api.createIssue(repo, token, issue);
      return { item: toItem(result.issue), skippedLabels: result.skippedLabels };
    },
    async tidy(repo, token, needs: Needs, managed: Made, catalog): Promise<TidyResult> {
      const github = extraOf(catalog);
      const labelsNeeded = (label: string): boolean => {
        const epic = epicOfLabel(label);
        if (epic !== null) return needs.epic(epic);
        const status = statusOfLabel(label);
        if (status !== null) return needs.status(status);
        return true;
      };
      const kept: Made = { labels: [...managed.labels], milestones: [...managed.milestones] };
      const gone: Made = { labels: [], milestones: [] };
      for (const label of [...kept.labels]) {
        if (!github.labels.some((item) => same(item, label))) {
          kept.labels = kept.labels.filter((item) => item !== label);
        } else if (!labelsNeeded(label)) {
          await api.deleteLabel(repo, token, label);
          kept.labels = kept.labels.filter((item) => item !== label);
          gone.labels.push(label);
        }
      }
      for (const title of [...kept.milestones]) {
        const milestone = github.milestones.find((item) => same(item.title, title));
        if (!milestone) {
          kept.milestones = kept.milestones.filter((item) => item !== title);
        } else if (!needs.release(title)) {
          await api.deleteMilestone(repo, token, milestone.number);
          kept.milestones = kept.milestones.filter((item) => item !== title);
          gone.milestones.push(title);
        }
      }
      return { managed: kept, gone };
    }
  };
}
