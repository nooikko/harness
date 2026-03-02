'use client';

import type { Project, Thread } from '@harness/database';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@harness/ui';
import { ChevronRight, FolderOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewProjectForm } from './new-project-form';
import { NewProjectThreadButton } from './new-project-thread-button';

type ProjectWithThreads = Project & { threads: Thread[] };

type NavProjectsProps = {
  projects: ProjectWithThreads[];
};

type NavProjectsComponent = (props: NavProjectsProps) => React.ReactNode;

export const NavProjects: NavProjectsComponent = ({ projects }) => {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className='flex items-center justify-between pr-1'>
        <span>Projects</span>
        <NewProjectForm />
      </SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((project) => (
          <Collapsible key={project.id} defaultOpen className='group/collapsible'>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <FolderOpen className='h-4 w-4' />
                  <span className='truncate'>{project.name}</span>
                  <ChevronRight className='ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {project.threads.map((thread) => {
                    const label = thread.name ?? thread.kind;
                    const href = `/chat/${thread.id}`;
                    const isActive = pathname === href;
                    return (
                      <SidebarMenuSubItem key={thread.id}>
                        <SidebarMenuSubButton asChild isActive={isActive}>
                          <Link href={href}>
                            <span className='truncate'>{label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                  <SidebarMenuSubItem>
                    <div className='flex items-center gap-2 px-2 py-1'>
                      <NewProjectThreadButton projectId={project.id} />
                      <span className='text-xs text-sidebar-foreground/50'>New chat</span>
                    </div>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <Link href={`/chat/projects/${project.id}`}>
                        <Settings className='h-3 w-3' />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
        {projects.length === 0 && (
          <SidebarMenuItem>
            <span className='px-3 py-2 text-xs text-sidebar-foreground/40'>No projects yet</span>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
};
