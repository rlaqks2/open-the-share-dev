/**
 * 운영 배포(npm run ship / deploy.bat) 전 안전장치.
 * origin 이 운영 저장소(rlaqks2/open-the-share-website)가 아니면 중단한다.
 *
 * 왜: 테스트 저장소(open-the-share-dev)를 clone 한 폴더에서 ship 을 실행하면
 *     `git push origin master` 가 운영이 아닌 테스트 저장소의 master 로 올라가
 *     "배포했는데 openthe.kr 이 안 바뀐다" + 테스트 저장소 오염이 생긴다.
 * 테스트 사이트 확인은 `npm run ship:dev` 를 쓴다. (docs/harness/DEPLOYMENT.md §1-1)
 */
import { execSync } from 'node:child_process';

const PROD_REPO = 'rlaqks2/open-the-share-website';

let url = '';
try {
    url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
} catch {
    console.error('[배포 중단] git origin 을 확인할 수 없습니다. 이 폴더가 git 저장소인지 확인하세요.');
    process.exit(1);
}

// https://github.com/rlaqks2/open-the-share-website(.git) / git@github.com:rlaqks2/open-the-share-website.git 모두 허용
const normalized = url.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
if (!normalized.toLowerCase().endsWith(`github.com/${PROD_REPO}`)) {
    console.error(`[배포 중단] origin 이 운영 저장소가 아닙니다.
  현재 origin : ${url}
  운영 저장소 : https://github.com/${PROD_REPO}

  - 테스트 사이트에 올리려면: npm run ship:dev
  - 운영에 올리려면: 운영 저장소를 clone 한 폴더에서 실행하거나,
    git remote add prod https://github.com/${PROD_REPO}.git 후 직접 push 하세요.`);
    process.exit(1);
}
