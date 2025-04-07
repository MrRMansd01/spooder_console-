// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing app...');
    
    try {
        // Make sure Supabase is available
        if (!window.supabase) {
            console.error('Supabase is not available! Make sure the Supabase script is loaded correctly.');
            alert('خطا در بارگذاری کتابخانه Supabase. لطفا صفحه را دوباره بارگذاری کنید.');
            return;
        }
        
        // Initialize Supabase client
        const supabaseUrl = 'https://lholzspyazziknxqopmi.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2x6c3B5YXp6aWtueHFvcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMjc0MTAsImV4cCI6MjA1NzYwMzQxMH0.uku06OF-WapBhuV-A_rJBXu3x24CKKkSTM0SnmPIOOE';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        console.log('Supabase client initialized successfully');
        
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            console.error('Authentication error:', authError);
            window.location.href = '/login.html';
            return;
        }
        
        if (!user) {
            console.log('No user logged in, redirecting to login');
            window.location.href = '/login.html';
            return;
        }
        
        console.log('User authenticated:', user);
        
        // DOM Elements
        const taskModal = document.getElementById('taskModal');
        const addTaskBtn = document.querySelector('.add-task-btn');
        const submitTaskBtn = document.querySelector('.submit-task-btn');
        const tasksContainer = document.querySelector('.tasks-container');
        const taskInput = document.querySelector('.task-input');
        const taskCount = document.querySelector('.task-count');
        const clearCompletedBtn = document.querySelector('.clear-completed-btn');
        const searchInput = document.querySelector('.search-input');
        const userNameElement = document.getElementById('username');
        const usersContainer = document.getElementById('users-container');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        // Check if all DOM elements are available
        if (!taskModal || !addTaskBtn || !submitTaskBtn || !tasksContainer || !taskInput) {
            console.error('Some DOM elements are missing!', {
                taskModal, addTaskBtn, submitTaskBtn, tasksContainer, taskInput
            });
            alert('خطا در بارگذاری صفحه. لطفا صفحه را دوباره بارگذاری کنید.');
            return;
        }
        
        console.log('All DOM elements loaded successfully');
        
        // Update username in sidebar
        userNameElement.textContent = user.user_metadata?.username || user.email;
        
        // Track active importance
        let activeImportance = 'score2'; // تعریف متغیر برای ذخیره اهمیت فعال
        
        // Load all users
        async function loadUsers() {
            try {
                console.log('Loading users...');
                
                // First try to get the current user's data
                const { data: userData, error: userError } = await supabase.auth.getUser();
                
                if (userError) {
                    console.error('Error getting current user:', userError);
                    usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
                    return;
                }
                
                // Create user task map to store all users and their task counts
                const userTaskMap = {};
                
                // Check if current user is admin
                const isAdmin = userData.user.id === 'bd9bad86-1746-4802-95f1-cb890f5cb0e3';
                console.log('Current user is admin:', isAdmin);
                
                // First, get all tasks to count tasks per user
                const { data: allTasks, error: tasksError } = await supabase
                    .from('tasks')
                    .select('user_id, title, created_at, user_email')
                    .order('created_at', { ascending: false });
                
                if (tasksError) {
                    console.error('Error fetching tasks:', tasksError);
                } else if (allTasks && allTasks.length > 0) {
                    console.log('Found tasks:', allTasks.length);
                    
                    // Count tasks for each user
                    allTasks.forEach(task => {
                        if (task.user_id) {
                            if (!userTaskMap[task.user_id]) {
                                // If we don't have this user in our map yet, add them
                                userTaskMap[task.user_id] = {
                                    count: 1,
                                    userData: {
                                        id: task.user_id,
                                        email: task.user_email || 'کاربر ' + task.user_id.substring(0, 6),
                                        user_metadata: {}
                                    }
                                };
                            } else {
                                // Increment task count for existing user
                                userTaskMap[task.user_id].count++;
                            }
                        }
                    });
                }
                
                // Get all users from users table
                const { data: users, error: usersError } = await supabase
                    .from('users')
                    .select('*');
                
                if (usersError) {
                    console.error('Error fetching users:', usersError);
                } else if (users && users.length > 0) {
                    console.log('Found users:', users.length);
                    
                    // If not admin, only show current user and admin
                    const filteredUsers = isAdmin ? users : users.filter(user => 
                        user.id === userData.user.id || user.id === 'bd9bad86-1746-4802-95f1-cb890f5cb0e3'
                    );
                    
                    // Add all users to the user map or update existing entries
                    filteredUsers.forEach(user => {
                        if (!userTaskMap[user.id]) {
                            // If this user doesn't exist in our map yet, add them with 0 tasks
                            userTaskMap[user.id] = {
                                count: 0,
                                userData: {
                                    id: user.id,
                                    email: user.email,
                                    user_metadata: {
                                        username: user.username || user.name || user.email
                                    }
                                }
                            };
                        } else {
                            // Update user data with user info
                            userTaskMap[user.id].userData.email = user.email || userTaskMap[user.id].userData.email;
                            userTaskMap[user.id].userData.user_metadata = userTaskMap[user.id].userData.user_metadata || {};
                            userTaskMap[user.id].userData.user_metadata.username = user.username || user.name || user.email;
                        }
                    });
                }
                
                // Make sure current user is included even if they have no tasks and no profile
                if (!userTaskMap[userData.user.id]) {
                    userTaskMap[userData.user.id] = {
                        count: 0,
                        userData: userData.user
                    };
                } else {
                    // Update with current user data if we already have this user
                    userTaskMap[userData.user.id].userData = userData.user;
                }
                
                // If we have no users at all (unlikely), just show current user
                if (Object.keys(userTaskMap).length === 0) {
                    userTaskMap[userData.user.id] = {
                        count: 0,
                        userData: userData.user
                    };
                }
                
                // Log the user task map for debugging
                console.log('User task map:', Object.keys(userTaskMap).map(id => {
                    return {
                        id: id,
                        email: userTaskMap[id].userData.email,
                        count: userTaskMap[id].count
                    };
                }));
                
                // Display users
                displayUsers(userTaskMap, userData.user.id);
                
                // Automatically select the current user and display their tasks
                const currentUserElement = document.querySelector(`.user-item[data-id="${userData.user.id}"]`);
                if (currentUserElement) {
                    currentUserElement.classList.add('selected');
                    const userName = userData.user.user_metadata?.username || userData.user.email || 'کاربر فعلی';
                    loadTasksForUser(userData.user.id, userName);
                }
                
            } catch (error) {
                console.error('Error in loadUsers:', error);
                usersContainer.innerHTML = '<li class="error-message">خطا در بارگذاری کاربران</li>';
            }
        }
        
        // Display users from the user task map
        function displayUsers(userTaskMap, currentUserId) {
            try {
                console.log('Displaying users...');
                usersContainer.innerHTML = '';
                
                // Check if current user is admin
                const isAdmin = currentUserId === 'bd9bad86-1746-4802-95f1-cb890f5cb0e3';
                
                // Convert the user map to an array for easier manipulation
                const usersArray = Object.keys(userTaskMap).map(id => {
                    return {
                        id: id,
                        userData: userTaskMap[id].userData,
                        count: userTaskMap[id].count
                    };
                });
                
                // Sort users by task count (descending)
                usersArray.sort((a, b) => b.count - a.count);
                
                // Add users to the container
                usersArray.forEach(userInfo => {
                    const { id, userData, count } = userInfo;
                    
                    // Get display name from user data
                    const displayName = userData.user_metadata?.username || 
                                       userData.user_metadata?.name || 
                                       userData.email || 
                                       'کاربر ' + id.substring(0, 6);
                    
                    // Create user element
                    const userElement = document.createElement('li');
                    userElement.className = 'user-item';
                    userElement.dataset.id = id;
                    userElement.dataset.name = displayName;
                    
                    // Add 'current-user' class if this is the current user
                    if (id === currentUserId) {
                        userElement.classList.add('current-user');
                    }
                    
                    // Add user info to element
                    userElement.innerHTML = `
                        <span class="user-name">${displayName}</span>
                        <span class="task-count">${count} تسک</span>
                    `;
                    
                    // If not admin and not current user, make it non-clickable
                    if (!isAdmin && id !== currentUserId) {
                        userElement.style.opacity = '0.6';
                        userElement.style.cursor = 'not-allowed';
                        userElement.title = 'دسترسی محدود است';
                    } else {
                        // Add click event listener
                        userElement.addEventListener('click', () => {
                            // Remove 'selected' class from all users
                            document.querySelectorAll('.user-item').forEach(item => {
                                item.classList.remove('selected');
                            });
                            
                            // Add 'selected' class to clicked user
                            userElement.classList.add('selected');
                            
                            // Load tasks for selected user
                            loadTasksForUser(id, displayName);
                        });
                    }
                    
                    // Add user element to container
                    usersContainer.appendChild(userElement);
                });
                
            } catch (error) {
                console.error('Error in displayUsers:', error);
                usersContainer.innerHTML = '<li class="error-message">خطا در نمایش کاربران</li>';
            }
        }
        
        // Load tasks for a specific user
        async function loadTasksForUser(userId, userName) {
            try {
                console.log(`Loading tasks for user: ${userName} (${userId})`);
                
                // Get current user
                const { data: userData } = await supabase.auth.getUser();
                const currentUserId = userData.user.id;
                
                // Check if current user is admin
                const isAdmin = currentUserId === 'bd9bad86-1746-4802-95f1-cb890f5cb0e3';
                
                // Only allow viewing tasks if current user is the owner or admin
                if (!isAdmin && currentUserId !== userId) {
                    console.error('Permission denied: Cannot view tasks of other users');
                    tasksContainer.innerHTML = '<div class="error-message" style="text-align: center; padding: 2rem; font-size: 1.2rem; color: #f44336;">دسترسی محدود است</div>';
                    
                    // Update task count to 0
                    const taskCountElement = document.querySelector('.task-count-number');
                    if (taskCountElement) {
                        taskCountElement.textContent = 0;
                    }
                    
                    return;
                }
                
                // Update the header to show whose tasks we're viewing
                const taskHeader = document.querySelector('.header');
                if (taskHeader) {
                    // Check if we already have a user-viewing element
                    let userViewingElement = document.querySelector('.viewing-user');
                    
                    if (!userViewingElement) {
                        // Create it if it doesn't exist
                        userViewingElement = document.createElement('div');
                        userViewingElement.className = 'viewing-user';
                        taskHeader.appendChild(userViewingElement);
                    }
                }
                
                // Get tasks for selected user
                const { data: tasks, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('Error fetching tasks for user:', error);
                    tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
                    return;
                }
                
                console.log(`Tasks loaded for ${userName}:`, tasks);
                
                // Clear tasks container
                tasksContainer.innerHTML = '';
                
                // Update task count
                const taskCountElement = document.querySelector('.task-count-number');
                if (taskCountElement) {
                    taskCountElement.textContent = tasks ? tasks.length : 0;
                }
                
                // Add tasks to container or show message if no tasks
                if (!tasks || tasks.length === 0) {
                    tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>';
                    return;
                }
                
                // Add tasks to container
                tasks.forEach(task => {
                    const taskElement = createTaskElement(task);
                    tasksContainer.appendChild(taskElement);
                });
                
                // Update stats
                updateStats(tasks);
            } catch (error) {
                console.error('Error in loadTasksForUser:', error);
                tasksContainer.innerHTML = '<div class="error-message">خطا در بارگذاری تسک‌ها</div>';
            }
        }
        
        // Load tasks from Supabase
        async function loadTasks() {
            try {
                console.log('Loading tasks...');
                
                // Get tasks for current user
                const { data: tasks, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('Error fetching tasks:', error);
                    return;
                }
                
                console.log('Tasks loaded:', tasks);
                
                // Clear tasks container
                tasksContainer.innerHTML = '';
                
                // Update task count
                const taskCountElement = document.querySelector('.task-count-number');
                if (taskCountElement) {
                    taskCountElement.textContent = tasks ? tasks.length : 0;
                }
                
                // Add tasks to container or show message if no tasks
                if (!tasks || tasks.length === 0) {
                    tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>';
                    return;
                }
                
                // Add tasks to container
                tasks.forEach(task => {
                    const taskElement = createTaskElement(task);
                    tasksContainer.appendChild(taskElement);
                });
                
                // Update stats
                updateStats(tasks);
            } catch (error) {
                console.error('Error in loadTasks:', error);
            }
        }
        
        // Helper function to convert Gregorian date to Persian (Shamsi/Jalali) date
        function formatPersianDate(date) {
            try {
                // تبدیل تاریخ میلادی به شمسی
                const gregorianDate = new Date(date);
                
                // بررسی معتبر بودن تاریخ
                if (isNaN(gregorianDate.getTime())) {
                    console.error('Invalid date:', date);
                    return 'تاریخ نامعتبر';
                }
                
                const persianDate = gregorianToJalali(
                    gregorianDate.getFullYear(),
                    gregorianDate.getMonth() + 1,
                    gregorianDate.getDate()
                );
                
                // نام ماه‌های شمسی
                const persianMonths = [
                    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
                ];
                
                // فرمت نمایش تاریخ شمسی
                return `${persianDate[2]} ${persianMonths[persianDate[1] - 1]} ${persianDate[0]}`;
            } catch (error) {
                console.error('Error formatting Persian date:', error);
                return 'خطا در نمایش تاریخ';
            }
        }
        
        // تبدیل تاریخ میلادی به شمسی با الگوریتم دقیق
        function gregorianToJalali(gy, gm, gd) {
            var g_d_m, jy, jm, jd, gy2, days;
            g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            
            if (gy > 1600) {
                jy = 979;
                gy -= 1600;
            } else {
                jy = 0;
                gy -= 621;
            }
            
            gy2 = (gm > 2) ? (gy + 1) : gy;
            days = (365 * gy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
            jy += 33 * (parseInt(days / 12053));
            days %= 12053;
            jy += 4 * (parseInt(days / 1461));
            days %= 1461;
            
            if (days > 365) {
                jy += parseInt((days - 1) / 365);
                days = (days - 1) % 365;
            }
            
            jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
            jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
            
            return [jy, jm, jd];
        }
        
        // Helper function to validate date
        function validateDate(dateString) {
            try {
                const date = new Date(dateString);
                
                // Check if date is valid
                if (isNaN(date.getTime())) {
                    console.error('Invalid date string:', dateString);
                    return new Date(); // Return current date as fallback
                }
                
                return date;
            } catch (error) {
                console.error('Error validating date:', error);
                return new Date(); // Return current date as fallback
            }
        }
        
        // Function to calculate task duration in minutes
        function calculateTaskDuration(timeStart, timeEnd) {
            try {
                if (!timeStart || !timeEnd) return 0;
                
                // تجزیه زمان‌های شروع و پایان
                const startParts = timeStart.split(' ');
                const endParts = timeEnd.split(' ');
                
                if (startParts.length < 2 || endParts.length < 2) return 0;
                
                const [startTimeStr, startAmPm] = startParts;
                const [endTimeStr, endAmPm] = endParts;
                
                const [startHourStr, startMinuteStr] = startTimeStr.split(':');
                const [endHourStr, endMinuteStr] = endTimeStr.split(':');
                
                let startHour = parseInt(startHourStr);
                let startMinute = parseInt(startMinuteStr);
                let endHour = parseInt(endHourStr);
                let endMinute = parseInt(endMinuteStr);
                
                // تبدیل به فرمت 24 ساعته
                if (startAmPm.toLowerCase() === 'pm' && startHour < 12) {
                    startHour += 12;
                } else if (startAmPm.toLowerCase() === 'am' && startHour === 12) {
                    startHour = 0;
                }
                
                if (endAmPm.toLowerCase() === 'pm' && endHour < 12) {
                    endHour += 12;
                } else if (endAmPm.toLowerCase() === 'am' && endHour === 12) {
                    endHour = 0;
                }
                
                // محاسبه دقیقه‌های کل
                const startMinutes = startHour * 60 + startMinute;
                const endMinutes = endHour * 60 + endMinute;
                
                // محاسبه اختلاف زمانی (به دقیقه)
                let duration = endMinutes - startMinutes;
                
                // اگر زمان پایان قبل از زمان شروع باشد (مثلاً شروع: 23:00، پایان: 01:00)
                if (duration < 0) {
                    duration += 24 * 60; // اضافه کردن 24 ساعت
                }
                
                return duration;
            } catch (error) {
                console.error('Error calculating task duration:', error, timeStart, timeEnd);
                return 0;
            }
        }

        // Create task element
        function createTaskElement(task) {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.color || 'score2'} ${task.is_completed ? 'completed' : ''}`;
            taskElement.dataset.id = task.id;
            
            try {
                // Format date for display
                const taskDate = validateDate(task.date);
                const formattedDate = formatPersianDate(taskDate);
                
                // Format created_at time
                const createdDate = validateDate(task.created_at);
                const hours = createdDate.getHours().toString().padStart(2, '0');
                const minutes = createdDate.getMinutes().toString().padStart(2, '0');
                const createdTime = `${hours}:${minutes}`;
                
                // Format created_at date in Persian
                const createdPersianDate = formatPersianDate(createdDate);
                
                // محاسبه مدت زمان انجام تسک
                let taskDurationText = '';
                if (task.time_start && task.time_end) {
                    const durationMinutes = calculateTaskDuration(task.time_start, task.time_end);
                    const durationHours = Math.floor(durationMinutes / 60);
                    const remainingMinutes = durationMinutes % 60;
                    
                    if (durationHours > 0) {
                        taskDurationText = `<div class="task-duration">مدت زمان: ${durationHours} ساعت`;
                        if (remainingMinutes > 0) {
                            taskDurationText += ` و ${remainingMinutes} دقیقه`;
                        }
                        taskDurationText += '</div>';
                    } else if (remainingMinutes > 0) {
                        taskDurationText = `<div class="task-duration">مدت زمان: ${remainingMinutes} دقیقه</div>`;
                    }
                }
                
                taskElement.innerHTML = `
                    <div class="task-checkbox">
                        <input type="checkbox" class="task-complete-checkbox" ${task.is_completed ? 'checked' : ''}>
                    </div>
                    <div class="task-content">
                        <div class="task-text">${task.title}</div>
                        <div class="task-time">${formattedDate} - ${task.time_start}</div>
                    </div>
                    <div class="task-info">
                        <div class="task-created-time">${createdPersianDate} ${createdTime}</div>
                        ${taskDurationText}
                        <div class="task-actions">
                            <button class="icon-btn edit-task-btn"><i class="fas fa-pen"></i></button>
                            <button class="icon-btn delete-task-btn"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error creating task element:', error);
                
                // نمایش تسک بدون تاریخ در صورت بروز خطا
                taskElement.innerHTML = `
                    <div class="task-checkbox">
                        <input type="checkbox" class="task-complete-checkbox" ${task.is_completed ? 'checked' : ''}>
                    </div>
                    <div class="task-content">
                        <div class="task-text">${task.title}</div>
                        <div class="task-time">تاریخ نامشخص</div>
                    </div>
                    <div class="task-info">
                        <div class="task-created-time">تاریخ نامشخص --:--</div>
                        <div class="task-actions">
                            <button class="icon-btn edit-task-btn"><i class="fas fa-pen"></i></button>
                            <button class="icon-btn delete-task-btn"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }
            
            // Add event listeners to task element
            const checkbox = taskElement.querySelector('.task-complete-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    toggleTaskCompletion(task);
                });
            }
            
            const editBtn = taskElement.querySelector('.edit-task-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    editTask(task);
                });
            }
            
            const deleteBtn = taskElement.querySelector('.delete-task-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    deleteTask(task.id);
                });
            }
            
            return taskElement;
        }
        
        // Edit task
        async function editTask(task) {
            try {
                // Show task modal with task data
                taskModal.classList.add('active');
                taskInput.value = task.title;
                
                // Set importance
                document.querySelectorAll('.importance-btn').forEach(btn => btn.classList.remove('active'));
                const importanceBtn = document.querySelector(`.importance-btn.${task.color || 'score2'}`);
                if (importanceBtn) {
                    importanceBtn.classList.add('active');
                    activeImportance = task.color || 'score2';
                }
                
                // Change submit button to update
                submitTaskBtn.textContent = 'بروزرسانی تسک';
                submitTaskBtn.dataset.mode = 'edit';
                submitTaskBtn.dataset.taskId = task.id;
                
                // Update submit button event listener
                submitTaskBtn.onclick = async () => {
                    const updatedText = taskInput.value.trim();
                    
                    if (!updatedText) {
                        alert('لطفا توضیحات تسک را وارد کنید');
                        return;
                    }
                    
                    try {
                        // Update task in Supabase
                        const { error } = await supabase
                            .from('tasks')
                            .update({ 
                                title: updatedText,
                                color: activeImportance,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', task.id);
                        
                        if (error) throw error;
                        
                        // Reset form and close modal
                        taskInput.value = '';
                        taskModal.classList.remove('active');
                        
                        // Reset submit button
                        submitTaskBtn.textContent = 'ثبت تسک';
                        submitTaskBtn.dataset.mode = 'add';
                        delete submitTaskBtn.dataset.taskId;
                        
                        // Reload tasks
                        await loadTasks();
                        alert('تسک با موفقیت بروزرسانی شد');
                        
                        // Reset event listener
                        submitTaskBtn.onclick = null;
                    } catch (error) {
                        console.error('Error updating task:', error);
                        alert('خطا در بروزرسانی تسک. لطفا دوباره تلاش کنید.');
                    }
                };
            } catch (error) {
                console.error('Error in editTask:', error);
            }
        }
        
        // Delete task
        async function deleteTask(taskId) {
            try {
                if (!confirm('آیا از حذف این تسک اطمینان دارید؟')) {
                    return;
                }
                
                // Delete task from Supabase
                const { error } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('id', taskId);
                
                if (error) throw error;
                
                // Reload tasks
                await loadTasks();
                alert('تسک با موفقیت حذف شد');
            } catch (error) {
                console.error('Error deleting task:', error);
                alert('خطا در حذف تسک. لطفا دوباره تلاش کنید.');
            }
        }
        
        // Toggle task completion
        async function toggleTaskCompletion(task) {
            try {
                // Update task completion status in Supabase
                const { error } = await supabase
                    .from('tasks')
                    .update({ 
                        is_completed: !task.is_completed,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.id);
                
                if (error) throw error;
                
                // Update task element in the DOM
                const taskElement = document.querySelector(`.task-item[data-id="${task.id}"]`);
                if (taskElement) {
                    if (!task.is_completed) {
                        taskElement.classList.add('completed');
                    } else {
                        taskElement.classList.remove('completed');
                    }
                }
                
                // Update task object
                task.is_completed = !task.is_completed;
                
                console.log(`Task ${task.id} completion status changed to: ${task.is_completed}`);
                
                // به‌روزرسانی آمار بعد از تغییر وضعیت تکمیل تسک
                const { data: allTasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (allTasks) {
                    updateStats(allTasks);
                }
            } catch (error) {
                console.error('Error toggling task completion:', error);
                alert('Error changing task status. Please try again.');
            }
        }
        
        // Function to update stats
        async function updateStats(tasks) {
            // Get stat elements
            const completedTasksElement = document.querySelectorAll('.stat-card .stat-number')[0];
            const pendingTasksElement = document.querySelectorAll('.stat-card .stat-number')[1];
            const totalStudyElement = document.querySelectorAll('.stat-card .stat-number')[2];
            
            if (!tasks) return;
            
            // Calculate stats
            const completedTasks = tasks.filter(task => task.is_completed).length;
            const pendingTasks = tasks.filter(task => !task.is_completed).length;
            
            // محاسبه کل زمان مطالعه
            let totalStudyMinutes = 0;
            
            tasks.forEach(task => {
                // فقط برای تسک‌های تکمیل شده زمان مطالعه را محاسبه می‌کنیم
                if (task.is_completed && task.time_start && task.time_end) {
                    try {
                        const taskDuration = calculateTaskDuration(task.time_start, task.time_end);
                        console.log(`Task ${task.id} (${task.title}): Start=${task.time_start}, End=${task.time_end}, Duration=${taskDuration} minutes`);
                        totalStudyMinutes += taskDuration;
                    } catch (error) {
                        console.error('Error calculating study time for task:', task.id, error);
                    }
                }
            });
            
            // Convert minutes to hours and minutes
            const totalStudyHours = Math.floor(totalStudyMinutes / 60);
            const remainingMinutes = totalStudyMinutes % 60;
            
            // Update the stats in the DOM
            if (completedTasksElement) completedTasksElement.textContent = completedTasks;
            if (pendingTasksElement) pendingTasksElement.textContent = pendingTasks;
            if (totalStudyElement) {
                if (totalStudyMinutes > 0) {
                    if (remainingMinutes > 0) {
                        totalStudyElement.innerHTML = `${totalStudyHours}:${remainingMinutes < 10 ? '0' + remainingMinutes : remainingMinutes}`;
                    } else {
                        totalStudyElement.textContent = `${totalStudyHours}:00`;
                    }
                } else {
                    totalStudyElement.textContent = '0:00';
                }
            }
            
            console.log(`Total study time: ${totalStudyHours} hours and ${remainingMinutes} minutes`);
        }
        
        // Event Listeners
        addTaskBtn.addEventListener('click', () => {
            // Show task modal
            taskModal.classList.add('active');
            
            // Reset task form
            taskInput.value = '';
            document.querySelectorAll('.importance-btn').forEach(btn => btn.classList.remove('active'));
            const importantBtn = document.querySelector('.importance-btn.score2');
            if (importantBtn) {
                importantBtn.classList.add('active');
                activeImportance = 'score2';
                console.log('Reset importance to: score2');
            }
            
            // Reset submit button
            submitTaskBtn.textContent = 'ثبت تسک';
            submitTaskBtn.dataset.mode = 'add';
            delete submitTaskBtn.dataset.taskId;
            submitTaskBtn.onclick = null; // Remove any previous event listeners
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === taskModal) {
                taskModal.classList.remove('active');
                console.log('Modal closed by clicking outside');
            }
        });
        
        // Add close button to modal
        const closeButtons = document.querySelectorAll('.close-modal');
        if (closeButtons) {
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const modal = btn.closest('.modal');
                    if (modal) {
                        modal.classList.remove('active');
                        console.log('Modal closed by close button');
                    }
                });
            });
        }
        
        submitTaskBtn.addEventListener('click', async () => {
            // Check if we're in edit mode
            if (submitTaskBtn.dataset.mode === 'edit') {
                return; // The edit function will handle this
            }
            
            const taskText = taskInput.value.trim();
            
            if (!taskText) {
                alert('لطفا توضیحات تسک را وارد کنید');
                return;
            }
            
            if (!activeImportance) {
                alert('لطفا اهمیت تسک را انتخاب کنید');
                return;
            }
            
            try {
                console.log('Adding new task...');
                console.log('Adding task with importance:', activeImportance);
                
                // Get selected date
                const selectedDate = window.selectedTaskDate || new Date();
                
                // Get selected time for start
                const startHour = parseInt(document.querySelectorAll('.hour-select')[0].value);
                const startMinute = parseInt(document.querySelectorAll('.minute-select')[0].value);
                const startAmPm = document.querySelectorAll('.ampm-select')[0].value;
                
                // Get selected time for end
                const endHour = parseInt(document.querySelectorAll('.hour-select')[1].value);
                const endMinute = parseInt(document.querySelectorAll('.minute-select')[1].value);
                const endAmPm = document.querySelectorAll('.ampm-select')[1].value;
                
                // Create task object
                const taskObject = { 
                    title: taskText, // Only use the task text without date and time
                    date: selectedDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
                    time_start: `${startHour}:${startMinute < 10 ? '0' + startMinute : startMinute} ${startAmPm}`,
                    time_end: `${endHour}:${endMinute < 10 ? '0' + endMinute : endMinute} ${endAmPm}`,
                    color: activeImportance, // Using importance as color
                    is_completed: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    user_id: user.id
                };
                
                console.log('Task object to insert:', taskObject);
                
                // Add task to Supabase
                const { data, error } = await supabase
                    .from('tasks')
                    .insert([taskObject]);
                
                if (error) {
                    console.error('Error inserting task:', error);
                    console.error('Error details:', error.details, error.hint, error.message);
                    alert(`Error adding task: ${error.message}`);
                    throw error;
                }
                
                console.log('Task added successfully', data);
                
                // Clear input and close modal
                taskInput.value = '';
                taskModal.classList.remove('active');
                
                // Reload tasks
                await loadTasks();
                alert('Task added successfully');
                
                // Reset importance buttons
                document.querySelectorAll('.importance-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                activeImportance = null;
            } catch (error) {
                console.error('Error adding task:', error);
                alert(`Error adding task. Please try again. Error: ${error.message || error}`);
            }
        });
        
        if (clearCompletedBtn) {
            clearCompletedBtn.addEventListener('click', async () => {
                try {
                    if (!confirm('آیا از حذف تمام تسک‌های تکمیل شده اطمینان دارید؟')) {
                        return;
                    }
                    
                    const { error } = await supabase
                        .from('tasks')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('is_completed', true);
                    
                    if (error) throw error;
                    
                    await loadTasks();
                    alert('تسک‌های تکمیل شده با موفقیت حذف شدند');
                } catch (error) {
                    console.error('Error clearing completed tasks:', error);
                    alert('خطا در حذف تسک‌های تکمیل شده. لطفا دوباره تلاش کنید.');
                }
            });
        }
        
        // Set active importance when clicking on importance buttons
        document.querySelectorAll('.importance-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                
                // Set active importance based on button class
                if (btn.classList.contains('score3')) {
                    activeImportance = 'score3';
                    console.log('Set importance to: score3');
                } else if (btn.classList.contains('score2')) {
                    activeImportance = 'score2';
                    console.log('Set importance to: score2');
                } else if (btn.classList.contains('score1')) {
                    activeImportance = 'score1';
                    console.log('Set importance to: score1');
                }
            });
        });
        
        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) throw error;
                    window.location.href = '/login.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    alert('خطا در خروج از حساب کاربری. لطفا دوباره تلاش کنید.');
                }
            });
        }
        
        // پر کردن سلکت‌های ساعت
        const hourSelects = document.querySelectorAll('.hour-select');
        hourSelects.forEach(select => {
            // خالی کردن سلکت قبل از پر کردن
            select.innerHTML = '';
            // اضافه کردن گزینه‌های ساعت از 1 تا 12
            for (let i = 1; i <= 12; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                select.appendChild(option);
            }
        });

        // پر کردن سلکت‌های دقیقه
        const minuteSelects = document.querySelectorAll('.minute-select');
        minuteSelects.forEach(select => {
            // خالی کردن سلکت قبل از پر کردن
            select.innerHTML = '';
            // اضافه کردن گزینه‌های دقیقه از 00 تا 59
            for (let i = 0; i <= 59; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i < 10 ? '0' + i : i;
                select.appendChild(option);
            }
        });

        // تابع نمایش روزهای ماه در تقویم
        function populateCalendar(year, month) {
            const daysContainer = document.querySelector('.days');
            if (!daysContainer) return;
            
            daysContainer.innerHTML = '';
            
            // محاسبه روز اول ماه
            const firstDay = new Date(year, month, 1).getDay();
            // محاسبه تعداد روزهای ماه
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            // اضافه کردن روزهای خالی قبل از روز اول ماه
            for (let i = 0; i < firstDay; i++) {
                const emptyDay = document.createElement('span');
                emptyDay.className = 'day empty';
                daysContainer.appendChild(emptyDay);
            }
            
            // اضافه کردن روزهای ماه
            for (let i = 1; i <= daysInMonth; i++) {
                const dayElement = document.createElement('span');
                dayElement.className = 'day';
                dayElement.textContent = i;
                
                // اضافه کردن رویداد کلیک به هر روز
                dayElement.addEventListener('click', function() {
                    // حذف کلاس selected از همه روزها
                    document.querySelectorAll('.day').forEach(day => {
                        day.classList.remove('selected');
                    });
                    // اضافه کردن کلاس selected به روز انتخاب شده
                    this.classList.add('selected');
                    
                    // ذخیره تاریخ انتخاب شده
                    window.selectedTaskDate = new Date(year, month, i);
                    console.log('تاریخ انتخاب شده:', window.selectedTaskDate);
                });
                
                daysContainer.appendChild(dayElement);
            }
        }

        // فراخوانی تابع نمایش تقویم با تاریخ فعلی
        const currentDate = new Date();
        populateCalendar(currentDate.getFullYear(), currentDate.getMonth());
        
        // Load tasks on page load
        await loadTasks();
        
        // Load users on page load
        await loadUsers();
        
        // Add event listeners for filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', async () => {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                button.classList.add('active');
                
                const filterValue = button.dataset.filter;
                console.log('Filter value:', filterValue);
                
                // Get tasks for current user
                const { data: tasks, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('Error fetching tasks:', error);
                    return;
                }
                
                // Filter tasks based on filter value
                let filteredTasks;
                if (filterValue === 'all') {
                    filteredTasks = tasks;
                } else if (filterValue === 'completed') {
                    filteredTasks = tasks.filter(task => task.is_completed);
                } else if (filterValue === 'incomplete') {
                    // تغییر فیلتر برای دکمه "فعال" - نمایش تسک‌های در حال انجام (false یا null)
                    filteredTasks = tasks.filter(task => !task.is_completed || task.is_completed === null);
                }
                
                // Clear tasks container
                tasksContainer.innerHTML = '';
                
                // Add tasks to container or show message if no tasks
                if (!filteredTasks || filteredTasks.length === 0) {
                    tasksContainer.innerHTML = '<div class="no-tasks">هیچ تسکی وجود ندارد</div>';
                    return;
                }
                
                // Add tasks to container
                filteredTasks.forEach(task => {
                    const taskElement = createTaskElement(task);
                    tasksContainer.appendChild(taskElement);
                });
                
                // Update stats
                updateStats(filteredTasks);
            });
        });
        
    } catch (error) {
        console.error('Fatal error initializing app:', error);
        alert('خطای جدی در راه‌اندازی برنامه. لطفا صفحه را دوباره بارگذاری کنید.');
    }
});
// Add this to your app.js file after DOM content loaded

// User search functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user search input exists
    const userSearchInput = document.querySelector('.search-box .search-input');
    
    if (userSearchInput) {
        console.log('User search input found, adding event listener');
        
        // Add event listener for the user search input
        userSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            searchUsers(searchTerm);
        });
    } else {
        console.log('User search input not found. Make sure to add the HTML element.');
    }
    
    /**
     * Search through users based on search term
     * @param {string} searchTerm - The term to search for
     */
    function searchUsers(searchTerm) {
        // Get all user elements
        const userElements = document.querySelectorAll('#users-container .user-item');
        
        console.log('Searching users for term:', searchTerm);
        console.log('Total users to search through:', userElements.length);
        
        // If search term is empty, show all users
        if (!searchTerm) {
            userElements.forEach(user => {
                user.style.display = '';
            });
            return;
        }
        
        let matchingUsers = 0;
        
        // Filter users based on search term
        userElements.forEach(user => {
            const userName = user.querySelector('.user-name').textContent.toLowerCase();
            const userTaskCount = user.querySelector('.task-count')?.textContent.toLowerCase() || '';
            
            // Check if user name or task count contains search term
            if (userName.includes(searchTerm) || userTaskCount.includes(searchTerm)) {
                user.style.display = ''; // Show user
                matchingUsers++;
            } else {
                user.style.display = 'none'; // Hide user
            }
        });
        
        console.log('Matching users found:', matchingUsers);
    }
});

// Calendar and Time Picker Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Populate hour selects
    const hourSelects = document.querySelectorAll('.hour-select');
    hourSelects.forEach(select => {
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i < 10 ? '0' + i : i;
            select.appendChild(option);
        }
        // Set default to 12
        select.value = 12;
    });

    // Populate minute selects
    const minuteSelects = document.querySelectorAll('.minute-select');
    minuteSelects.forEach(select => {
        for (let i = 0; i < 60; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i < 10 ? '0' + i : i;
            select.appendChild(option);
        }
        // Set default to 00
        select.value = 0;
    });

    // Initialize calendar
    const today = new Date();
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();
    
    // Display current month and year
    updateMonthDisplay(currentMonth, currentYear);
    
    // Populate calendar
    populateCalendar(currentYear, currentMonth);
    
    // Add event listeners for month navigation
    document.querySelector('.prev').addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        updateMonthDisplay(currentMonth, currentYear);
        populateCalendar(currentYear, currentMonth);
    });
    
    document.querySelector('.next').addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        updateMonthDisplay(currentMonth, currentYear);
        populateCalendar(currentYear, currentMonth);
    });
});

// Update month display
function updateMonthDisplay(month, year) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    document.querySelector('.current-month').textContent = `${months[month]} ${year}`;
}

// Populate calendar with days
function populateCalendar(year, month) {
    const daysContainer = document.querySelector('.days');
    daysContainer.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust first day to start from Monday (0) instead of Sunday (0)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedFirstDay; i++) {
        const emptyDay = document.createElement('span');
        emptyDay.classList.add('empty');
        daysContainer.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('span');
        dayElement.textContent = i;
        
        // Highlight today
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayElement.classList.add('active');
        }
        
        // Add click event to select day
        dayElement.addEventListener('click', function() {
            // Remove active class from all days
            document.querySelectorAll('.days span').forEach(day => {
                day.classList.remove('active');
            });
            
            // Add active class to selected day
            this.classList.add('active');
            
            // Store selected date (you can use this to save the task date later)
            const selectedDate = new Date(year, month, i);
            console.log('Selected date:', selectedDate);
            
            // Store the selected date in a global variable or data attribute
            window.selectedTaskDate = selectedDate;
        });
        
        daysContainer.appendChild(dayElement);
    }
}

// Add a new task
async function addNewTask() {
    try {
        // Get the task title from the input field
        const taskTitle = document.getElementById('new-task-title').value.trim();
        
        // Check if the task title is empty
        if (!taskTitle) {
            alert('لطفا عنوان تسک را وارد کنید');
            return;
        }
        
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('Error getting current user:', userError);
            alert('خطا در دریافت اطلاعات کاربر');
            return;
        }
        
        // Get the current user ID and email
        const userId = userData.user.id;
        const userEmail = userData.user.email;
        
        // Create the task object
        const newTask = {
            title: taskTitle,
            status: 'in_progress', // Default status
            user_id: userId,
            user_email: userEmail,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Add the task to the database
        const { data, error } = await supabase
            .from('tasks')
            .insert([newTask]);
        
        if (error) {
            console.error('Error adding task:', error);
            alert('خطا در افزودن تسک');
            return;
        }
        
        console.log('Task added successfully:', newTask);
        
        // Clear the input field
        document.getElementById('new-task-title').value = '';
        
        // Reload tasks for the current user
        const userName = userData.user.user_metadata?.username || userEmail || 'کاربر فعلی';
        loadTasksForUser(userId, userName);
        
        // Also reload users to update task counts
        loadUsers();
    } catch (error) {
        console.error('Error in addNewTask:', error);
        alert('خطا در افزودن تسک');
    }
}

// Show task creation modal
function showTaskModal() {
    document.getElementById('taskModal').classList.add('active');
}

// Hide task creation modal
function hideTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
}