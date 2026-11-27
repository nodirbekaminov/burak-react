import { Box } from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Button from "@mui/material/Button";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useGlobals } from '../../hooks/useGlobals';
import { Messages, serverApi } from '../../../lib/config';
import { MemberUpdateInput } from '../../../lib/types/member';
import { sweetErrorHandling, sweetTopSmallSuccessAlert } from '../../../lib/sweetAlert';
import MemberService from '../../services/MemberService';

export function Settings() {
  const { authMember, setAuthMember } = useGlobals();
  const [memberUpdate, setMemberUpdate] = useState<MemberUpdateInput>({
    memberNick: authMember?.memberNick || '',
    memberPhone: authMember?.memberPhone || '',
    memberAddress: authMember?.memberAddress || '',
    memberDesc: authMember?.memberDesc || '',
    memberImage: authMember?.memberImage,
  });
  const [memberImage, setMemberImage] = useState(
    authMember?.memberImage
      ? `${serverApi}/${authMember.memberImage}`
      : '/icons/default-user.svg'
  );
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    setMemberUpdate({
      memberNick: authMember?.memberNick || '',
      memberPhone: authMember?.memberPhone || '',
      memberAddress: authMember?.memberAddress || '',
      memberDesc: authMember?.memberDesc || '',
      memberImage: authMember?.memberImage,
    });
    setMemberImage(
      authMember?.memberImage
        ? `${serverApi}/${authMember.memberImage}`
        : '/icons/default-user.svg'
    );
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    }
  }, [authMember]);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setMemberUpdate((previous) => ({ ...previous, [name]: value }));
  };

  const handleImageViewer = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!['image/jpg', 'image/jpeg', 'image/png'].includes(file.type)) {
      sweetErrorHandling(new Error(Messages.error5)).then();
      e.currentTarget.value = '';
      return;
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(file);
    setMemberImage(previewUrl.current);
    setMemberUpdate((previous) => ({ ...previous, memberImage: file }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!authMember) throw new Error(Messages.error2);
      if (
        !memberUpdate.memberNick?.trim() ||
        !memberUpdate.memberPhone?.trim() ||
        !memberUpdate.memberAddress?.trim() ||
        !memberUpdate.memberDesc?.trim()
      ) throw new Error(Messages.error3);

      const member = await new MemberService().updateMember(memberUpdate);
      setAuthMember(member);
      await sweetTopSmallSuccessAlert('Modified successfully!', 700);
    } catch (err) {
      console.log(err);
      sweetErrorHandling(err).then();
    }
  };

  return (
    <Box component="form" className={"settings"} onSubmit={handleSubmit}>
      <Box className={"member-media-frame"}>
        <img
          src={memberImage}
          alt={authMember?.memberNick || 'Member'}
          className={"mb-image"}
        />
        <div className={"media-change-box"}>
          <span>Upload image</span>
          <p>JPG, JPEG, PNG formats only!</p>
          <div className={"up-del-box"}>
            <Button component="label">
              <CloudDownloadIcon />
              <input
                type="file"
                name="memberImage"
                accept="image/jpeg,image/png"
                aria-label="Upload profile image"
                onChange={handleImageViewer}
                hidden
              />
            </Button>
          </div>
        </div>
      </Box>
      <Box className={"input-frame"}>
        <div className={"long-input"}>
          <label className={"spec-label"} htmlFor="memberNick">Username</label>
          <input
            id="memberNick"
            className={"spec-input mb-nick"}
            type="text"
            placeholder={"Username"}
            value={memberUpdate.memberNick}
            onChange={handleInputChange}
            name="memberNick"
          />
        </div>
      </Box>
      <Box className={"input-frame"}>
        <div className={"short-input"}>
          <label className={"spec-label"} htmlFor="memberPhone">Phone</label>
          <input
            id="memberPhone"
            className={"spec-input mb-phone"}
            type="text"
            placeholder={"no phone"}
            value={memberUpdate.memberPhone}
            onChange={handleInputChange}
            name="memberPhone"
          />
        </div>
        <div className={"short-input"}>
          <label className={"spec-label"} htmlFor="memberAddress">Address</label>
          <input
            id="memberAddress"
            className={"spec-input  mb-address"}
            type="text"
            placeholder={"no address"}
            value={memberUpdate.memberAddress}
            onChange={handleInputChange}
            name="memberAddress"
          />
        </div>
      </Box>
      <Box className={"input-frame"}>
        <div className={"long-input"}>
          <label className={"spec-label"} htmlFor="memberDesc">Description</label>
          <textarea
            id="memberDesc"
            className={"spec-textarea mb-description"}
            placeholder={"no description"}
            value={memberUpdate.memberDesc}
            onChange={handleInputChange}
            name="memberDesc"
          />
        </div>
      </Box>
      <Box className={"save-box"}>
        <Button type="submit" variant={"contained"}>Save</Button>
      </Box>
    </Box>
  );
}
