import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { fireEvent, getByLabelText } from '@testing-library/react';
import { Router, Route, Switch } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import UserPage from './index';
import { Settings } from './Settings';
import axios from 'axios';
import { GlobalContext } from '../../hooks/useGlobals';
import { Member } from '../../../lib/types/member';
import { MemberStatus, MemberType } from '../../../lib/enums/member.enum';
import { sweetErrorHandling, sweetTopSmallSuccessAlert } from '../../../lib/sweetAlert';

jest.mock('../../../lib/sweetAlert', () => ({
  sweetErrorHandling: jest.fn(),
  sweetTopSmallSuccessAlert: jest.fn(),
}));

const member: Member = {
  _id: 'member-1',
  memberType: MemberType.USER,
  memberStatus: MemberStatus.ACTIVE,
  memberNick: 'Nick',
  memberPhone: '123456789',
  memberAddress: 'Tashkent',
  memberDesc: 'Original description',
  memberImage: 'uploads/members/nick.jpg',
  memberPoints: 0,
  createdAt: new Date('2025-01-01'),
  updateAt: new Date('2025-01-01'),
};

function TestGlobals({ children, initialMember }: {
  children: React.ReactNode;
  initialMember: Member | null;
}) {
  const [authMember, setAuthMember] = useState(initialMember);
  const [orderBuilder, setOrderBuilder] = useState(new Date());
  return (
    <GlobalContext.Provider value={{
      authMember, setAuthMember, orderBuilder, setOrderBuilder,
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

let container: HTMLDivElement;
let root: Root;
let post: jest.SpyInstance;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
  URL.createObjectURL = jest.fn(() => 'blob:profile-preview');
  URL.revokeObjectURL = jest.fn();
  (sweetErrorHandling as jest.Mock).mockResolvedValue(undefined);
  (sweetTopSmallSuccessAlert as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  post = jest.spyOn(axios, 'post').mockImplementation(async (_url, data) => ({
    data: {
      ...member,
      memberNick: data.get('memberNick'),
      memberPhone: data.get('memberPhone'),
      memberAddress: data.get('memberAddress'),
      memberDesc: data.get('memberDesc'),
      memberImage: data.has('memberImage')
        ? 'uploads/members/updated.jpg'
        : member.memberImage,
    },
  }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

async function mount(initialMember: Member | null = member, settingsOnly = false) {
  const history = createMemoryHistory({ initialEntries: ['/member-page'] });
  await act(async () => {
    root.render(
      <Router history={history}>
        <TestGlobals initialMember={initialMember}>
          <Switch>
            <Route path="/member-page">
              {settingsOnly ? <Settings /> : <UserPage />}
            </Route>
            <Route path="/"><div>Home page</div></Route>
          </Switch>
        </TestGlobals>
      </Router>
    );
  });
  return history;
}

test('loads authenticated member details and lets each profile field be edited', async () => {
  await mount();
  expect(container.querySelector('.order-user-name')).toHaveTextContent('Nick');
  expect(container.querySelector('.user-desc'))
    .toHaveTextContent('Original description');
  expect(container.querySelector('.order-user-avatar')).toHaveAttribute(
    'src', expect.stringContaining('/uploads/members/nick.jpg')
  );

  for (const [label, initial, updated] of [
    ['Username', 'Nick', 'New Nick'],
    ['Phone', '123456789', '987654321'],
    ['Address', 'Tashkent', 'Samarkand'],
    ['Description', 'Original description', 'Updated description'],
  ]) {
    const input = getByLabelText(container, label);
    expect(input).toHaveValue(initial);
    act(() => fireEvent.change(input, { target: { value: updated } }));
    expect(input).toHaveValue(updated);
  }
});

async function submit() {
  await act(async () => fireEvent.submit(container.querySelector('form')!));
}

async function selectImage(files: File[]) {
  await act(async () => fireEvent.change(
    container.querySelector('input[type="file"]')!,
    { target: { files } }
  ));
}

test('saves edited fields as multipart, preserves an unchanged photo, and updates context/storage', async () => {
  await mount();
  act(() => fireEvent.change(getByLabelText(container, 'Username'), {
    target: { value: 'Updated Nick' },
  }));
  await submit();

  const [url, payload, config] = post.mock.calls[0];
  expect(url).toEqual(expect.stringContaining('/member/update'));
  expect(payload).toBeInstanceOf(FormData);
  expect(payload.get('memberNick')).toBe('Updated Nick');
  expect(payload.get('memberPhone')).toBe(member.memberPhone);
  expect(payload.get('memberAddress')).toBe(member.memberAddress);
  expect(payload.get('memberDesc')).toBe(member.memberDesc);
  expect(payload.has('memberImage')).toBe(false);
  expect(config).toEqual({ withCredentials: true });
  expect(container.querySelector('.order-user-name'))
    .toHaveTextContent('Updated Nick');
  expect(JSON.parse(localStorage.getItem('memberData')!)).toMatchObject({
    memberNick: 'Updated Nick', memberImage: member.memberImage,
  });
  expect(sweetTopSmallSuccessAlert)
    .toHaveBeenCalledWith('Modified successfully!', 700);
});

test('previews a valid image, submits the File, and releases the preview after save', async () => {
  await mount();
  const file = new File(['photo'], 'profile.png', { type: 'image/png' });
  await selectImage([file]);
  expect(container.querySelector('.mb-image'))
    .toHaveAttribute('src', 'blob:profile-preview');
  await submit();

  const payload: FormData = post.mock.calls[0][1];
  expect(payload.get('memberImage')).toBeInstanceOf(File);
  expect((payload.get('memberImage') as File).name).toBe('profile.png');
  expect(container.querySelector('.mb-image')).toHaveAttribute(
    'src', expect.stringContaining('/uploads/members/updated.jpg')
  );
  expect(container.querySelector('.order-user-avatar')).toHaveAttribute(
    'src', expect.stringContaining('/uploads/members/updated.jpg')
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
});

test('rejects unsupported files and safely ignores cancelled image selection', async () => {
  await mount();
  const originalSrc = container.querySelector('.mb-image')!.getAttribute('src');
  await selectImage([]);
  await selectImage([new File(['gif'], 'profile.gif', { type: 'image/gif' })]);

  expect(sweetErrorHandling).toHaveBeenCalledTimes(1);
  expect(sweetErrorHandling).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('jpeg, jpg, png'),
  }));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(container.querySelector('.mb-image')).toHaveAttribute('src', originalSrc);
  expect(post).not.toHaveBeenCalled();
});

test('releases previous image previews on replacement and when leaving the page', async () => {
  const history = await mount();
  (URL.createObjectURL as jest.Mock)
    .mockReturnValueOnce('blob:first-preview')
    .mockReturnValueOnce('blob:second-preview');
  await selectImage([new File(['first'], 'first.jpg', { type: 'image/jpeg' })]);
  await selectImage([new File(['second'], 'second.png', { type: 'image/png' })]);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-preview');

  act(() => history.push('/'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second-preview');
});

test.each(['Username', 'Phone', 'Address', 'Description'])(
  'rejects an empty %s before saving', async (label) => {
    await mount();
    act(() => fireEvent.change(getByLabelText(container, label), {
      target: { value: '   ' },
    }));
    await submit();
    expect(post).not.toHaveBeenCalled();
    expect(sweetErrorHandling).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Please fullfill all inputs!' })
    );
  }
);

test('settings rejects saving without authentication', async () => {
  await mount(null, true);
  await submit();
  expect(post).not.toHaveBeenCalled();
  expect(sweetErrorHandling).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Please login first!' })
  );
});

test('a failed save keeps local edits and the original persisted profile', async () => {
  const error = new Error('Save failed');
  post.mockRejectedValue(error);
  await mount();
  act(() => fireEvent.change(getByLabelText(container, 'Username'), {
    target: { value: 'Unsaved Nick' },
  }));
  await submit();

  expect(sweetErrorHandling).toHaveBeenCalledWith(error);
  expect(container.querySelector('.order-user-name')).toHaveTextContent('Nick');
  expect(getByLabelText(container, 'Username')).toHaveValue('Unsaved Nick');
  expect(localStorage.getItem('memberData')).toBeNull();
  expect(sweetTopSmallSuccessAlert).not.toHaveBeenCalled();
});

test('redirects unauthenticated visits to home without rendering settings', async () => {
  const history = await mount(null);
  expect(history.location.pathname).toBe('/');
  expect(container).toHaveTextContent('Home page');
  expect(container.querySelector('.settings')).toBeNull();
});

test('uses the restaurant badge for restaurant members', async () => {
  await mount({ ...member, memberType: MemberType.RESTAURANT });
  expect(container.querySelector('.order-user-icon-box img'))
    .toHaveAttribute('src', '/icons/restaurant.svg');
});
