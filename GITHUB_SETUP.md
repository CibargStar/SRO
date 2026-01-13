# Инструкция по созданию нового репозитория на GitHub и пушу кода

## Вариант 1: Создание нового репозитория через веб-интерфейс GitHub

### Шаг 1: Создание репозитория на GitHub

1. Перейдите на [GitHub](https://github.com/new)
2. Заполните форму:
   - **Repository name:** `SRO` (или любое другое имя)
   - **Description:** (опционально) Описание проекта
   - **Visibility:** Выберите Public или Private
   - **НЕ** устанавливайте галочки:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
3. Нажмите кнопку **"Create repository"**

### Шаг 2: Подключение локального репозитория к новому GitHub репозиторию

После создания репозитория GitHub покажет инструкции. Выполните следующие команды:

```powershell
# Перейдите в директорию проекта
cd c:\Users\CibargStar\Desktop\SRO

# Удалите старый remote (если нужно создать новый репозиторий)
git remote remove origin

# Добавьте новый remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/SRO.git

# Переименуйте ветку в main (если нужно)
git branch -M main

# Запушьте код в новый репозиторий
git push -u origin main
```

**Примечание:** Если вы хотите использовать существующий репозиторий `https://github.com/CibargStar/SRO.git`, просто выполните:

```powershell
cd c:\Users\CibargStar\Desktop\SRO
git push -u origin main
```

---

## Вариант 2: Использование существующего репозитория

Если вы хотите использовать существующий репозиторий `https://github.com/CibargStar/SRO.git`:

```powershell
cd c:\Users\CibargStar\Desktop\SRO

# Проверьте текущий remote
git remote -v

# Если remote правильный, просто запушьте код
git push -u origin main
```

---

## Вариант 3: Создание нового репозитория через GitHub CLI (если установлен)

Если у вас установлен GitHub CLI (`gh`):

```powershell
# Создайте новый репозиторий
gh repo create SRO --public --source=. --remote=origin --push

# Или для приватного репозитория
gh repo create SRO --private --source=. --remote=origin --push
```

---

## Проверка после пуша

После успешного пуша:

1. Откройте ваш репозиторий на GitHub: `https://github.com/YOUR_USERNAME/SRO`
2. Убедитесь, что все файлы загружены
3. Проверьте, что файлы `.env`, `node_modules`, `.cursor/`, `uploads/` **НЕ** видны в репозитории (они должны быть в `.gitignore`)

---

## Если возникли проблемы

### Ошибка: `remote origin already exists`

```powershell
# Удалите старый remote
git remote remove origin

# Добавьте новый
git remote add origin https://github.com/YOUR_USERNAME/SRO.git
```

### Ошибка: `failed to push some refs`

```powershell
# Сначала получите изменения с сервера
git pull origin main --allow-unrelated-histories

# Затем запушьте
git push -u origin main
```

### Ошибка: `authentication failed`

Убедитесь, что вы авторизованы в Git:

```powershell
# Проверьте текущую конфигурацию
git config --global user.name
git config --global user.email

# Если нужно, установите
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Для GitHub используйте Personal Access Token вместо пароля:
1. Перейдите в GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Создайте новый token с правами `repo`
3. Используйте token вместо пароля при push

---

## Что дальше?

После успешного пуша:

1. ✅ Код загружен в GitHub
2. ✅ Другие разработчики могут клонировать репозиторий
3. ✅ Можно настроить CI/CD
4. ✅ Можно работать с ветками и pull requests

**Следующий шаг:** См. [SETUP_GUIDE.md](./SETUP_GUIDE.md) для инструкций по установке и запуску проекта.
