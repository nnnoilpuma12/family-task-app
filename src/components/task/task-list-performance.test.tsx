import {render, cleanup} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {TaskList} from '@/components/task/task-list';
const renders=vi.hoisted(()=>({count:0}));
vi.mock("framer-motion", () => {
  const MOTION_PROPS = [
    "initial", "animate", "exit", "transition", "whileTap", "whileHover",
    "drag", "dragConstraints", "dragElastic", "onDragEnd", "style",
  ];
  function makeMotionComponent(tag: string) {
    return function MotionComponent(props: Record<string, unknown> & { children?: ReactNode }) {
      const domProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (key !== "children" && !MOTION_PROPS.includes(key)) domProps[key] = value;
      }
      return createElement(tag, domProps, props.children);
    };
  }
  return {
    motion: { div: makeMotionComponent("div"), span: makeMotionComponent("span") },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useMotionValue: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
    useTransform: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
  };
});

// 本物の DnD context/useSortable を通し、memo を迂回する context 更新も数える。
vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return { ...actual, useSortable: (...args: Parameters<typeof actual.useSortable>) => {
    renders.count++;
    return actual.useSortable(...args);
  } };
});
vi.mock('@/components/ui/confirm-dialog',()=>({ConfirmDialog:()=>null}));
afterEach(cleanup);
it('counts actual memoized TaskItem renders for one changed title',()=>{
 const tasks=Array.from({length:100},(_,i)=>({id:String(i),title:'task '+i,is_done:false,category_id:null,created_by:null,due_date:null,memo:null,url:null,household_id:'h',sort_order:i,completed_at:null,created_at:'2026-01-01',updated_at:'2026-01-01'}));
 const props={categories:[],members:[],onToggle:vi.fn(),onTap:vi.fn(),onDelete:vi.fn(),onReorder:vi.fn(),onDeleteAllDone:vi.fn()};
 const view=render(<TaskList tasks={tasks} {...props}/>);
 const initial=renders.count;
 renders.count=0;
 view.rerender(<TaskList tasks={tasks} {...props}/>);
 const unchanged=renders.count;
 renders.count=0;
 const next=tasks.map((t,i)=>i===0?{...t,title:'changed'}:t);
 view.rerender(<TaskList tasks={next} {...props}/>);
 expect(initial).toBeGreaterThanOrEqual(100);
 expect(unchanged).toBe(0); expect(renders.count).toBe(1);
});
