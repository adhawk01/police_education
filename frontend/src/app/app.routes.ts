import { Routes } from '@angular/router';
import { guestOnlyGuard, authGuard, adminRoleGuard } from './auth/auth.guards';
import { AdminPageComponent } from './admin/admin-page.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ContentDetailsComponent } from './content/content-details.component';
import { HomeComponent } from './home/home.component';
import { AuthenticatedShellComponent } from './layout/authenticated-shell.component';
import { SearchComponent } from './search/search.component';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: 'login', component: LoginComponent, canActivate: [guestOnlyGuard] },
	{ path: 'register', component: RegisterComponent, canActivate: [guestOnlyGuard] },
	{
		path: '',
		component: AuthenticatedShellComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'home', component: HomeComponent },
			{ path: 'search', component: SearchComponent },
			{ path: 'admin', component: AdminPageComponent, canActivate: [adminRoleGuard] },
			{ path: 'content/:id', component: ContentDetailsComponent }
		]
	},
	{ path: '**', redirectTo: 'login' }
];
