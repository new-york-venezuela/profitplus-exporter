# SP: pvRepTurno
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepTurno
*DESCRIPCIÓN	: Reporte de Turnos de Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 

CREATE PROCEDURE [dbo].[pvRepTurno] 
    @sCo_Turno_d CHAR(6) = NULL ,
    @sCo_Turno_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0																					
AS 
    BEGIN
        SELECT
            co_turno, des_turno, 
			(RIGHT('00' + LTRIM(rtrim(convert(char(2),hora_ini))),2) + ':' + RIGHT('00' + LTRIM(RTRIM(convert(Char(2), minu_ini))),2)) as hora_ini, (case when ampm_ini = 'A' then 'A.M.' else 'P.M.' end) as ampm_ini, 
			(RIGHT('00' + LTRIM(rtrim(convert(char (2), hora_fin))),2)+ ':'+ RIGHT('00' + LTRIM(RTRIM(convert(Char(2), minu_fin))),2))as hora_fin, (case when ampm_fin = 'A' then 'A.M.' else 'P.M.' end) as ampm_fin
        FROM
            pvTurno
                WHERE
            ( ( @sCo_Turno_d IS NULL
                OR @sCo_Turno_d <= co_turno
              )
              AND ( @sCo_Turno_h IS NULL
                    OR co_turno <= @sCo_Turno_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
				 WHEN 'DESC' THEN 
					CASE @sCampOrderBy
                         WHEN 'des_turno' THEN des_turno
                         ELSE co_turno
                    END
				  END DESC, 
			CASE @sDir
                 WHEN 'ASC' THEN 
					CASE @sCampOrderBy
                         WHEN 'des_turno' THEN des_turno
                         ELSE co_turno
                    END
             END ASC
    END
```
