import { test as base } from '@playwright/test';
import { CronJobsPage } from './pages/admin/cron-jobs.page';
import { PluginsPage } from './pages/admin/plugins.page';
import { ProfilePage } from './pages/admin/profile.page';
import { AgentsPage } from './pages/agents.page';
import { BasePage } from './pages/base.page';
import { CalendarPage } from './pages/calendar.page';
import { ProjectsPage } from './pages/projects.page';
import { TasksPage } from './pages/tasks.page';
import { ThreadPage } from './pages/thread.page';

type E2EFixtures = {
  basePage: BasePage;
  cronJobsPage: CronJobsPage;
  pluginsPage: PluginsPage;
  profilePage: ProfilePage;
  agentsPage: AgentsPage;
  projectsPage: ProjectsPage;
  tasksPage: TasksPage;
  calendarPage: CalendarPage;
  threadPage: ThreadPage;
};

export const test = base.extend<E2EFixtures>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
  cronJobsPage: async ({ page }, use) => {
    await use(new CronJobsPage(page));
  },
  pluginsPage: async ({ page }, use) => {
    await use(new PluginsPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  agentsPage: async ({ page }, use) => {
    await use(new AgentsPage(page));
  },
  projectsPage: async ({ page }, use) => {
    await use(new ProjectsPage(page));
  },
  tasksPage: async ({ page }, use) => {
    await use(new TasksPage(page));
  },
  calendarPage: async ({ page }, use) => {
    await use(new CalendarPage(page));
  },
  threadPage: async ({ page }, use) => {
    await use(new ThreadPage(page));
  },
});

export { expect } from '@playwright/test';
