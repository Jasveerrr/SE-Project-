export default {
  "*.{js,jsx,json,css,md}": ["prettier --write"],
  "frontend/**/*.{js,jsx}": ["eslint --fix"],
  "backend/**/*.{js}": ["eslint --fix"],
};
