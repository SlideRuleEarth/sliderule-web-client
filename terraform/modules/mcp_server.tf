# ── MCP Server Infrastructure (ECS Fargate + ALB) ─────────────────
# Gated by var.create_mcp_server (default false)

locals {
  mcp_name_prefix = "${replace(var.domainApex, ".", "-")}-mcp"
}

# ── Networking (default VPC) ──────────────────────────────────────

data "aws_vpc" "default" {
  count   = var.create_mcp_server ? 1 : 0
  default = true
}

data "aws_subnets" "default" {
  count = var.create_mcp_server ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
}

# ── Security Groups ───────────────────────────────────────────────

resource "aws_security_group" "mcp_alb" {
  count       = var.create_mcp_server ? 1 : 0
  name        = "${local.mcp_name_prefix}-alb"
  description = "MCP server ALB - inbound HTTPS"
  vpc_id      = data.aws_vpc.default[0].id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "mcp_ecs" {
  count       = var.create_mcp_server ? 1 : 0
  name        = "${local.mcp_name_prefix}-ecs"
  description = "MCP server ECS tasks - inbound from ALB only"
  vpc_id      = data.aws_vpc.default[0].id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.mcp_alb[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── ECR Repository ────────────────────────────────────────────────

resource "aws_ecr_repository" "mcp_server" {
  count                = var.create_mcp_server ? 1 : 0
  name                 = "${local.mcp_name_prefix}-server"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "mcp_server" {
  count      = var.create_mcp_server ? 1 : 0
  repository = aws_ecr_repository.mcp_server[0].name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ── CloudWatch Logs ───────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "mcp_server" {
  count             = var.create_mcp_server ? 1 : 0
  name              = "/ecs/${local.mcp_name_prefix}-server"
  retention_in_days = 30
}

# ── IAM Roles ─────────────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume" {
  count = var.create_mcp_server ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "mcp_task_execution" {
  count              = var.create_mcp_server ? 1 : 0
  name               = "${local.mcp_name_prefix}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume[0].json
}

resource "aws_iam_role_policy_attachment" "mcp_task_execution" {
  count      = var.create_mcp_server ? 1 : 0
  role       = aws_iam_role.mcp_task_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "mcp_task" {
  count              = var.create_mcp_server ? 1 : 0
  name               = "${local.mcp_name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume[0].json
}

# ── ECS Cluster ───────────────────────────────────────────────────

resource "aws_ecs_cluster" "mcp" {
  count = var.create_mcp_server ? 1 : 0
  name  = "${local.mcp_name_prefix}"
}

# ── ECS Task Definition ──────────────────────────────────────────

resource "aws_ecs_task_definition" "mcp_server" {
  count                    = var.create_mcp_server ? 1 : 0
  family                   = "${local.mcp_name_prefix}-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.mcp_task_execution[0].arn
  task_role_arn            = aws_iam_role.mcp_task[0].arn

  container_definitions = jsonencode([{
    name      = "mcp-server"
    image     = "${aws_ecr_repository.mcp_server[0].repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "SR_DOMAIN", value = var.domainApex },
      { name = "SR_MCP_HOSTNAME", value = "mcp.${var.domainApex}" },
      { name = "SR_AUTH_HOSTNAME", value = "login.${var.domainApex}" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.mcp_server[0].name
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "mcp"
      }
    }
  }])
}

# ── ALB ───────────────────────────────────────────────────────────

resource "aws_lb" "mcp" {
  count              = var.create_mcp_server ? 1 : 0
  name               = "${local.mcp_name_prefix}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.mcp_alb[0].id]
  subnets            = data.aws_subnets.default[0].ids
  idle_timeout       = 3600 # 1 hour for WebSocket connections
}

resource "aws_lb_target_group" "mcp" {
  count       = var.create_mcp_server ? 1 : 0
  name        = "${local.mcp_name_prefix}"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default[0].id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }
}

resource "aws_lb_listener" "mcp_https" {
  count             = var.create_mcp_server ? 1 : 0
  load_balancer_arn = aws_lb.mcp[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.mysite.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.mcp[0].arn
  }
}

# ── ECS Service ───────────────────────────────────────────────────

resource "aws_ecs_service" "mcp_server" {
  count           = var.create_mcp_server ? 1 : 0
  name            = "${local.mcp_name_prefix}-server"
  cluster         = aws_ecs_cluster.mcp[0].id
  task_definition = aws_ecs_task_definition.mcp_server[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default[0].ids
    security_groups  = [aws_security_group.mcp_ecs[0].id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.mcp[0].arn
    container_name   = "mcp-server"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.mcp_https]
}

# ── Route53 ───────────────────────────────────────────────────────

resource "aws_route53_record" "mcp" {
  count   = var.create_mcp_server ? 1 : 0
  zone_id = data.aws_route53_zone.public.id
  name    = "mcp.${var.domainApex}"
  type    = "A"

  alias {
    name                   = aws_lb.mcp[0].dns_name
    zone_id                = aws_lb.mcp[0].zone_id
    evaluate_target_health = true
  }
}
