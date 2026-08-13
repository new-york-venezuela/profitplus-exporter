# SP: pSeleccionarComentarioFacturaVentaIF_CUSTOM
**Tipo**: Seleccionar
**Módulo**: Ventas

## Código (excerpt)
```sql
/************************************************************************
--NOMBRE		: pSeleccionarComentarioFacturaVentaIF_CUSTOM
--AUTOR			: SOFTECH SISTEMAS
--Create Date: 2017-10-04
--Descripción: Imprime comentarios ajustados al decreto 3.085 providencia 0048 
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarComentarioFacturaVentaIF_CUSTOM] ( @sDoc_Num CHAR(20) )
AS 
   BEGIN 
   
    -- NOMBRES DE NODOS BASE
	DECLARE @lcustom char(8),@lcustom_fin char(9),@llinea char(8),@llinea_fin char(8)
	set @lcustom     = '<custom>'
	set @lcustom_fin = '</custom>'
	set @llinea      = '<linea>'
	set @llinea_fin  = '</linea>'
	
	-- NOMBRES DE NODOS DE IMPRESORAS
	DECLARE @nodo_imp1 char(6),@nodo_imp1_fin char(7), @tope_imp1 int
	set @nodo_imp1      = '<P500>'  
	set @nodo_imp1_fin  = '</P500>' 
	set @tope_imp1 = 38	
   	----Solo debe devolver un(1) registro.
	
SELECT TOP 1
@lcustom +
           @nodo_imp1 +
           @llinea + 'SE APLICARA REBAJA DEL I.V.A.' + @llinea_fin +
           @llinea + 'SEGUN DECRETO 3.085/G.0.41.239' + @llinea_fin +
           @nodo_imp1_fin +
           @lcustom_fin comentario
           FROM
            factura f
            INNER JOIN reng_fac dcr ON dcr.fact_num = f.fact_num
           
            WHERE f.fact_num = @sDoc_Num 
			and f.fec_emis between (select val_aux from auxiliar where nom_aux='FPROD1    ') and (select val_aux from auxiliar where nom_aux='FPROH1    ')
    END
```
