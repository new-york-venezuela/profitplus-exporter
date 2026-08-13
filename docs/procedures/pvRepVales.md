# SP: pvRepVales
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepVales
*DESCRIPCIÓN	: Reporte de Vales de Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepVales]  
	@sCo_vale_d CHAR(6) = NULL ,
    @sCo_vale_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sActivo char(2)  =NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0																							

AS 
    BEGIN
        SELECT
			va.co_vale, de.valor, va.vale_descrip, 
			(case when va.inactivo = '0' then 'Activo' else 'Inactivo' end) as inactivoPadre,
			(case when va.inactivo = '0' and de.inactivo = '0' then 'Activo' else 'Inactivo' end) as inactivoHijo
        FROM    
			pvValeAlimentacion va
            INNER JOIN pvValeAlimentacionReng de ON de.co_vale = va.co_vale
        WHERE
            ( ( @sCo_Vale_d IS NULL
                OR @sCo_Vale_d <= va.co_vale
              )
            AND ( @sCo_Vale_h IS NULL
                 OR va.co_vale <= @sCo_Vale_h
                 )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR va.co_sucu_in = @sCo_Sucursal
                )
            AND (@sActivo is null OR va.inactivo = @sActivo)
        ORDER BY
            CASE @sDir
				 WHEN 'DESC' THEN 
					CASE @sCampOrderBy
                         WHEN 'vale_descrip' THEN va.vale_descrip
                         ELSE va.co_vale
                    END
				  END DESC, 
			CASE @sDir
                 WHEN 'ASC' THEN 
					CASE @sCampOrderBy
                         WHEN 'vale_descrip' THEN va.vale_descrip
                         ELSE va.co_vale
                    END
             END ASC
    END
```
